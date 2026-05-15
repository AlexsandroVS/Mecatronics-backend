import { InventoryMovementType } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "../../../shared/db/prisma.js";
import { validateBody, validateQuery } from "../../../shared/http/validate-request.js";
import { InventoryMovementService } from "./inventory-movement.service.js";
import { AuditService } from "../../audit/audit.service.js";
import type { JwtPayload } from "../../auth/auth.types.js";

function startOfDayUtc(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function endOfDayUtc(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T23:59:59.999Z`);
}

function parseDateRange(input: { dateFrom?: string; dateTo?: string }): { dateFrom?: Date; dateTo?: Date } {
  return {
    dateFrom: input.dateFrom ? startOfDayUtc(input.dateFrom) : undefined,
    dateTo: input.dateTo ? endOfDayUtc(input.dateTo) : undefined
  };
}

function contentDispositionFilename(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `attachment; filename="${safe}"`;
}

function movementTypeLabel(t: InventoryMovementType): string {
  if (t === "PURCHASE") return "Compra";
  if (t === "SALE") return "Venta";
  if (t === "WORKSHOP") return "Taller";
  return "Ajuste";
}

function formatDateTime(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function pdfHeader(
  doc: PdfDoc,
  input: Readonly<{
    title: string;
    productLabel: string;
    rangeLabel: string;
    totalLabel: string;
  }>
) {
  const x0 = doc.page.margins.left;
  const y0 = doc.page.margins.top;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const h = 78;

  doc.save();
  doc.roundedRect(x0, y0, w, h, 10).fill("#ffffff");
  doc.roundedRect(x0, y0, w, h, 10).strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.roundedRect(x0, y0, 10, h, 10).fill("#2563eb");
  doc.roundedRect(x0 + 6, y0 + 8, w - 14, h - 16, 8).fillOpacity(0.04).fill("#0b1220").fillOpacity(1);

  doc.fillColor("#0b1220").fontSize(9).text("Inventario · Mecatrónica", x0 + 18, y0 + 12, { width: w - 30 });
  doc.fillColor("#0f172a").fontSize(18).text(input.title, x0 + 18, y0 + 28, { width: w - 30 });

  doc.fontSize(9).fillColor("#64748b");
  const leftW = Math.max(240, w - 190);
  doc.text(input.productLabel, x0 + 18, y0 + 52, { width: leftW });
  doc.text(input.rangeLabel, x0 + 18, y0 + 63, { width: leftW });
  doc.text(input.totalLabel, x0 + 18, y0 + 52, { width: w - 30, align: "right" });

  doc.restore();
  doc.y = y0 + h + 14;
}

function pdfTableHeader(doc: PdfDoc, input: { x0: number; cols: { label: string; width: number }[] }) {
  const x0 = input.x0;
  const y0 = doc.y;
  const h = 18;

  doc.save();
  doc.roundedRect(x0, y0, input.cols.reduce((a, c) => a + c.width, 0), h, 6).fill("#2563eb");
  doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");

  let x = x0;
  for (const c of input.cols) {
    doc.text(c.label, x + 6, y0 + 5, { width: c.width - 12, ellipsis: true });
    x += c.width;
  }
  doc.restore();
  doc.y = y0 + h;
}

function pdfRowHeight(doc: PdfDoc, cols: { width: number }[], cells: string[]) {
  let max = 0;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (!col) continue;
    const h = doc.heightOfString(cells[i] ?? "", { width: col.width - 12 });
    if (h > max) max = h;
  }
  return Math.max(16, max + 6);
}

function pdfDrawRow(
  doc: PdfDoc,
  input: {
    x0: number;
    cols: { width: number }[];
    cells: string[];
    zebra: boolean;
  }
) {
  const x0 = input.x0;
  const y0 = doc.y;
  const rowH = pdfRowHeight(doc, input.cols, input.cells);
  const totalW = input.cols.reduce((a, c) => a + c.width, 0);

  doc.save();
  if (input.zebra) doc.rect(x0, y0, totalW, rowH).fill("#f8fafc");

  doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
  let x = x0;
  for (let i = 0; i < input.cols.length; i++) {
    const col = input.cols[i];
    if (!col) continue;
    doc.text(input.cells[i] ?? "", x + 6, y0 + 4, { width: col.width - 12 });
    x += col.width;
  }
  doc.restore();
  doc.y = y0 + rowH;
}

const createMovementSchema = z
  .object({
    productId: z.coerce.number().int().positive(),
    type: z.nativeEnum(InventoryMovementType),
    quantity: z.coerce.number().int(),
    referenceDoc: z.string().trim().min(1).max(120).nullable().optional()
  })
  .superRefine((val, ctx) => {
    if (val.type === "ADJUSTMENT") {
      if (val.quantity === 0) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Debe ser distinto de 0" });
      return;
    }

    if (val.quantity <= 0) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Debe ser > 0" });
  });

const dateStrSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const listMovementsQuerySchema = z
  .object({
    productId: z.coerce.number().int().positive(),
    dateFrom: dateStrSchema.optional(),
    dateTo: dateStrSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional()
  })
  .superRefine((q, ctx) => {
    if ((q.dateFrom && !q.dateTo) || (!q.dateFrom && q.dateTo)) {
      ctx.addIssue({ code: "custom", path: ["dateFrom"], message: "dateFrom y dateTo deben enviarse juntos" });
    }
  });

const listGlobalQuerySchema = z
  .object({
    dateFrom: dateStrSchema.optional(),
    dateTo: dateStrSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional()
  })
  .superRefine((q, ctx) => {
    if ((q.dateFrom && !q.dateTo) || (!q.dateFrom && q.dateTo)) {
      ctx.addIssue({ code: "custom", path: ["dateFrom"], message: "dateFrom y dateTo deben enviarse juntos" });
    }
  });

const exportQuerySchema = z
  .object({
    productId: z.coerce.number().int().positive().optional(),
    dateFrom: dateStrSchema.optional(),
    dateTo: dateStrSchema.optional(),
    format: z.enum(["PDF", "XLSX"])
  })
  .superRefine((q, ctx) => {
    if ((q.dateFrom && !q.dateTo) || (!q.dateFrom && q.dateTo)) {
      ctx.addIssue({ code: "custom", path: ["dateFrom"], message: "dateFrom y dateTo deben enviarse juntos" });
    }
  });

export const inventoryMovementRoutes: FastifyPluginAsync = async (app) => {
  const service = new InventoryMovementService(prisma());
  const audit = new AuditService(prisma());

  app.get("/", async (req) => {
    const query = validateQuery(req, listMovementsQuerySchema, "Query inválido");
    const range = parseDateRange(query);
    return service.listByProductId({
      productId: query.productId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo
    });
  });

  app.get("/global", async (req) => {
    const query = validateQuery(req, listGlobalQuerySchema, "Query inválido");
    const range = parseDateRange(query);
    return service.listGlobal({
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo
    });
  });

  app.get("/export", async (req, reply) => {
    const query = validateQuery(req, exportQuerySchema, "Query inválido");
    const range = parseDateRange(query);

    const rows = await service.listForReport({
      productId: query.productId,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      limit: 10_000
    });

    const from = query.dateFrom ?? "sin-fecha";
    const to = query.dateTo ?? "sin-fecha";
    const scope = query.productId ? `producto-${query.productId}` : "global";

    if (query.format === "XLSX") {
      const wb = new ExcelJS.Workbook();
      wb.creator = "mecatronics-inventario";
      const ws = wb.addWorksheet("Movimientos");

      ws.columns = [
        { header: "Fecha", key: "date", width: 20 },
        { header: "Producto", key: "product", width: 42 },
        { header: "Tipo", key: "type", width: 14 },
        { header: "Cant.", key: "qty", width: 8 },
        { header: "Stock antes", key: "before", width: 12 },
        { header: "Stock después", key: "after", width: 13 },
        { header: "Documento", key: "doc", width: 18 },
        { header: "Usuario", key: "user", width: 28 }
      ];

      for (const r of rows) {
        ws.addRow({
          date: r.createdAt.toISOString(),
          product: `${r.product.name} (${r.product.skuInternal})`,
          type: r.type,
          qty: r.quantity,
          before: r.stockBefore,
          after: r.stockAfter,
          doc: r.referenceDoc ?? "",
          user: r.actorUser?.email ?? ""
        });
      }

      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];

      const buf = await wb.xlsx.writeBuffer();
      const filename = `movimientos-${scope}-${from}_${to}.xlsx`;
      reply.header("content-disposition", contentDispositionFilename(filename));
      reply.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return reply.send(Buffer.from(buf));
    }

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const filename = `movimientos-${scope}-${from}_${to}.pdf`;
    reply.header("content-disposition", contentDispositionFilename(filename));
    reply.type("application/pdf");

    const productName = query.productId ? rows[0]?.product.name ?? `#${query.productId}` : "Global";
    const productLabel = `Producto: ${productName}`;
    const rangeLabel = query.dateFrom && query.dateTo ? `Rango: ${query.dateFrom} → ${query.dateTo}` : "Rango: (sin filtro)";
    const totalLabel = `Total movimientos: ${rows.length}`;
    pdfHeader(doc, { title: "Reporte de movimientos", productLabel, rangeLabel, totalLabel });

    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tablePadX = 10;
    const tableX = doc.page.margins.left + tablePadX;
    const tableW = pageW - tablePadX * 2;

    const dateW = 68;
    const typeW = 48;
    const qtyW = 32;
    const beforeW = 38;
    const afterW = 42;
    const docW = 56;
    const fixed = dateW + typeW + qtyW + beforeW + afterW + docW;
    const remain = Math.max(0, tableW - fixed);
    const productW = Math.max(190, Math.floor(remain * 0.58));
    const userW = Math.max(70, remain - productW);
    const cols = [
      { label: "Fecha", width: dateW },
      { label: "Producto", width: productW },
      { label: "Tipo", width: typeW },
      { label: "Cant.", width: qtyW },
      { label: "Antes", width: beforeW },
      { label: "Después", width: afterW },
      { label: "Doc", width: docW },
      { label: "Usuario", width: Math.max(60, tableW - (dateW + productW + typeW + qtyW + beforeW + afterW + docW)) }
    ];

    pdfTableHeader(doc, { x0: tableX, cols });

    const pageBottom = doc.page.height - doc.page.margins.bottom - 16;
    let zebra = false;
    for (const r of rows) {
      const cells = [
        formatDateTime(r.createdAt),
        `${r.product.name}\n${r.product.skuInternal}`,
        movementTypeLabel(r.type),
        String(r.quantity),
        String(r.stockBefore),
        String(r.stockAfter),
        r.referenceDoc ?? "",
        r.actorUser?.email ?? ""
      ];

      const needH = pdfRowHeight(doc, cols, cells);
      if (doc.y + needH > pageBottom) {
        doc.addPage();
        pdfHeader(doc, { title: "Reporte de movimientos", productLabel, rangeLabel, totalLabel });
        pdfTableHeader(doc, { x0: tableX, cols });
        zebra = false;
      }

      pdfDrawRow(doc, { x0: tableX, cols, cells, zebra });
      zebra = !zebra;
    }

    doc.end();
    return reply.send(doc);
  });

  app.post("/", async (req, reply) => {
    const body = validateBody(req, createMovementSchema, "Body inválido");
    const payload = (req.user ?? null) as JwtPayload | null;
    const created = await service.create({
      productId: body.productId,
      type: body.type,
      quantity: body.quantity,
      referenceDoc: body.referenceDoc ?? null,
      actorUserId: payload?.uid ?? null
    });

    const product = await prisma().product.findUnique({
      where: { id: created.productId },
      select: { name: true, skuInternal: true }
    });

    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "INVENTORY_MOVEMENT_CREATE",
        entityType: "InventoryMovement",
        entityId: created.id,
        metadata: {
          productId: created.productId,
          productName: product?.name ?? null,
          productSkuInternal: product?.skuInternal ?? null,
          type: created.type,
          quantity: created.quantity,
          stockBefore: created.stockBefore,
          stockAfter: created.stockAfter,
          referenceDoc: created.referenceDoc
        },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return reply.status(201).send(created);
  });
};
