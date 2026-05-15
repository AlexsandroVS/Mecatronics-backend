import type { FastifyPluginAsync } from "fastify";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "../../../shared/db/prisma.js";
import { validateBody, validateParams, validateQuery } from "../../../shared/http/validate-request.js";
import { ProductService } from "./product.service.js";
import { productKindValues } from "./product.types.js";
import { AuditService } from "../../audit/audit.service.js";
import type { JwtPayload } from "../../auth/auth.types.js";
import { requireAdmin } from "../../../shared/auth/require-admin.js";

type PdfDoc = InstanceType<typeof PDFDocument>;

function contentDispositionFilename(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `attachment; filename="${safe}"`;
}

function productKindLabel(k: string): string {
  if (k === "MACHINE") return "Maquinaria";
  if (k === "CONSUMABLE") return "Consumible";
  if (k === "ACCESSORY") return "Accesorio";
  return "Repuesto";
}

function pdfHeader(doc: PdfDoc, title: string, subtitle?: string) {
  const x0 = doc.page.margins.left;
  const y0 = doc.page.margins.top;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const h = 64;

  doc.save();
  doc.roundedRect(x0, y0, w, h, 10).fill("#ffffff");
  doc.roundedRect(x0, y0, w, h, 10).strokeColor("#e2e8f0").lineWidth(1).stroke();
  doc.roundedRect(x0, y0, 10, h, 10).fill("#2563eb");
  doc.roundedRect(x0 + 6, y0 + 8, w - 14, h - 16, 8).fillOpacity(0.04).fill("#0b1220").fillOpacity(1);

  doc.fillColor("#0b1220").fontSize(9).text("Inventario · Mecatrónica", x0 + 18, y0 + 12, { width: w - 30 });
  doc.fillColor("#0f172a").fontSize(18).text(title, x0 + 18, y0 + 28, { width: w - 30 });
  if (subtitle) doc.fillColor("#64748b").fontSize(9).text(subtitle, x0 + 18, y0 + 50, { width: w - 30 });
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

function pdfDrawRow(doc: PdfDoc, input: { x0: number; cols: { width: number }[]; cells: string[]; zebra: boolean }) {
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

const moneySchema = z
  .union([z.number().positive(), z.string().regex(/^\d+(\.\d+)?$/)])
  .transform((v) => (typeof v === "number" ? String(v) : v));

const specsSchema = z
  .object({
    modelo: z.string().trim().min(1).max(120).optional(),
    cilindrada_cc: z.coerce.number().positive().optional(),
    potencia_kw: z.coerce.number().positive().optional(),
    potencia_hp: z.coerce.number().positive().optional(),
    peso_kg: z.coerce.number().positive().optional(),
    espada_recomendada_pulg: z.string().trim().min(1).max(40).optional(),
    paso_cadena: z.string().trim().min(1).max(40).optional(),
    codigo_oem: z.string().trim().min(1).max(80).optional(),
    viscosidad: z.string().trim().min(1).max(80).optional(),
    capacidad_ml: z.coerce.number().int().positive().optional(),
    observaciones: z.string().trim().min(1).max(400).optional()
  })
  .partial();

const attributesSchema = z
  .array(
    z.object({
      key: z.string().trim().min(1).max(40),
      value: z.string().trim().min(1).max(160)
    })
  )
  .max(40);

function buildTechnicalSpecs(input: { specs?: z.infer<typeof specsSchema>; attributes?: z.infer<typeof attributesSchema> }) {
  const out: Record<string, unknown> = {};
  if (input.specs) Object.assign(out, input.specs);
  if (input.attributes) {
    for (const { key, value } of input.attributes) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000).nullable().optional(),
  kind: z.enum(productKindValues).optional(),
  brandId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive(),
  imageUrls: z.array(z.string().url()).max(1).optional(),
  specs: specsSchema.optional(),
  attributes: attributesSchema.optional(),
  stockMin: z.coerce.number().int().min(0).optional(),
  priceCost: moneySchema,
  priceSell: moneySchema
});

const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().min(1).max(4000).nullable().optional(),
    kind: z.enum(productKindValues).optional(),
    brandId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    imageUrls: z.array(z.string().url()).max(1).optional(),
    specs: specsSchema.optional(),
    attributes: attributesSchema.optional(),
    stockMin: z.coerce.number().int().min(0).optional(),
    priceCost: moneySchema.optional(),
    priceSell: moneySchema.optional()
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "Debe enviar al menos un campo" });

const productIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const listProductsQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  page: z.coerce.number().int().min(1).optional(),
  kind: z.enum(productKindValues).optional(),
  lowStock: z.coerce.boolean().optional(),
  sort: z.enum(["NAME", "STOCK", "PRICE_SELL"]).optional(),
  dir: z.enum(["ASC", "DESC"]).optional()
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  const db = prisma();
  const service = new ProductService(db);
  const audit = new AuditService(db);

  app.get("/", async (req) => {
    const query = validateQuery(req, listProductsQuerySchema, "Query inválido");
    const page = query.page ?? 1;
    return service.list({
      q: query.q,
      limit: 20,
      offset: (page - 1) * 20,
      kind: query.kind,
      lowStock: query.lowStock ?? false,
      sort: query.sort ?? "NAME",
      dir: query.dir ?? "ASC"
    });
  });

  app.get("/search", async (req) => {
    const query = validateQuery(
      req,
      z.object({
        q: z.string().trim().min(1).max(160),
        kind: z.enum(productKindValues).optional(),
        machineSubtype: z.string().trim().min(1).max(40).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional()
      }),
      "Query inválido"
    );
    return service.search({ q: query.q, kind: query.kind, machineSubtype: query.machineSubtype, limit: query.limit ?? 20 });
  });

  app.get("/export", async (req, reply) => {
    const query = validateQuery(
      req,
      z.object({
        q: z.string().trim().min(1).max(160).optional(),
        kind: z.enum(productKindValues).optional(),
        lowStock: z.coerce.boolean().optional(),
        sort: z.enum(["NAME", "STOCK"]).optional(),
        dir: z.enum(["ASC", "DESC"]).optional(),
        format: z.enum(["PDF", "XLSX"])
      }),
      "Query inválido"
    );

    const items = await service.listForExport({
      q: query.q,
      kind: query.kind,
      lowStock: query.lowStock ?? false,
      sort: query.sort ?? "NAME",
      dir: query.dir ?? "ASC",
      limit: 2000
    });

    const filenameBase = `productos-${query.sort ?? "NAME"}-${query.dir ?? "ASC"}${query.lowStock ? "-bajo-stock" : ""}`;
    if (query.format === "XLSX") {
      const wb = new ExcelJS.Workbook();
      wb.creator = "mecatronics-inventario";
      const ws = wb.addWorksheet("Productos");
      ws.columns = [
        { header: "Nombre", key: "name", width: 46 },
        { header: "Tipo", key: "kind", width: 14 },
        { header: "Stock", key: "stock", width: 10 },
        { header: "Stock mín.", key: "stockMin", width: 11 },
        { header: "Marca", key: "brand", width: 18 },
        { header: "Categoría", key: "category", width: 18 }
      ];
      for (const p of items) {
        ws.addRow({
          name: p.name,
          kind: productKindLabel(p.kind),
          stock: p.currentStock,
          stockMin: p.stockMin,
          brand: p.brandName,
          category: p.categoryName
        });
      }
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columns.length }
      };

      const buf = await wb.xlsx.writeBuffer();
      reply.header("content-disposition", contentDispositionFilename(`${filenameBase}.xlsx`));
      reply.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return reply.send(Buffer.from(buf));
    }

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    reply.header("content-disposition", contentDispositionFilename(`${filenameBase}.pdf`));
    reply.type("application/pdf");

    const subtitle = `Generado: ${new Date().toLocaleString("es-PE")}`;
    pdfHeader(doc, "Listado de productos", subtitle);
    doc.fontSize(9).fillColor("#334155").text(`Total: ${items.length}`, { continued: false });
    if (query.kind) doc.text(`Tipo: ${productKindLabel(query.kind)}`);
    if (query.lowStock) doc.text("Filtro: bajo stock");
    if (query.q) doc.text(`Buscar: ${query.q}`);
    doc.moveDown(0.45);

    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tablePadX = 10;
    const tableX = doc.page.margins.left + tablePadX;
    const tableW = pageW - tablePadX * 2;
    const fixed = 70 + 44 + 38;
    const remain = Math.max(0, tableW - fixed);
    const nameW = Math.max(230, Math.floor(remain * 0.58));
    const brandW = Math.max(72, Math.floor(remain * 0.11));
    const catW = Math.max(140, remain - nameW - brandW);
    const cols = [
      { label: "Nombre", width: nameW },
      { label: "Tipo", width: 70 },
      { label: "Stock", width: 44 },
      { label: "Mín.", width: 38 },
      { label: "Marca", width: brandW },
      { label: "Categoría", width: Math.max(60, tableW - (nameW + 70 + 44 + 38 + brandW)) }
    ];

    pdfTableHeader(doc, { x0: tableX, cols });

    const pageBottom = doc.page.height - doc.page.margins.bottom - 16;
    let zebra = false;
    for (const p of items) {
      const cells = [p.name, productKindLabel(p.kind), String(p.currentStock), String(p.stockMin), p.brandName, p.categoryName];
      const needH = pdfRowHeight(doc, cols, cells);
      if (doc.y + needH > pageBottom) {
        doc.addPage();
        pdfHeader(doc, "Listado de productos", subtitle);
        pdfTableHeader(doc, { x0: tableX, cols });
        zebra = false;
      }
      pdfDrawRow(doc, { x0: tableX, cols, cells, zebra });
      zebra = !zebra;
    }

    doc.end();
    return reply.send(doc);
  });

  app.get("/:id", async (req) => {
    const params = validateParams(req, productIdParamsSchema, "Params inválidos");
    return service.getById(params.id);
  });

  app.post("/", async (req, reply) => {
    const body = validateBody(req, createProductSchema, "Body inválido");
    const created = await service.create({
      name: body.name,
      description: body.description ?? null,
      kind: body.kind ?? "PART",
      brandId: body.brandId,
      categoryId: body.categoryId,
      technicalSpecs: buildTechnicalSpecs({ specs: body.specs, attributes: body.attributes }),
      imageUrls: body.imageUrls,
      stockMin: body.stockMin ?? 0,
      priceCost: body.priceCost,
      priceSell: body.priceSell
    });

    const payload = (req.user ?? null) as JwtPayload | null;
    const [brand, category] = await Promise.all([
      db.brand.findUnique({ where: { id: created.brandId }, select: { name: true } }),
      db.category.findUnique({ where: { id: created.categoryId }, select: { name: true } })
    ]);
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "PRODUCT_CREATE",
        entityType: "Product",
        entityId: created.id,
        metadata: {
          name: created.name,
          kind: created.kind,
          brandId: created.brandId,
          brandName: brand?.name ?? null,
          categoryId: created.categoryId,
          categoryName: category?.name ?? null
        },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return reply.status(201).send(created);
  });

  app.patch("/:id", async (req) => {
    const params = validateParams(req, productIdParamsSchema, "Params inválidos");
    const body = validateBody(req, updateProductSchema, "Body inválido");

    const updated = await service.update(params.id, {
      name: body.name,
      description: body.description,
      brandId: body.brandId,
      categoryId: body.categoryId,
      kind: body.kind,
      imageUrls: body.imageUrls,
      technicalSpecs:
        body.specs || body.attributes ? buildTechnicalSpecs({ specs: body.specs, attributes: body.attributes }) : undefined,
      stockMin: body.stockMin,
      priceCost: body.priceCost,
      priceSell: body.priceSell
    });

    const payload = (req.user ?? null) as JwtPayload | null;
    const changed = Object.entries(body)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    const [brand, category] = await Promise.all([
      db.brand.findUnique({ where: { id: updated.brandId }, select: { name: true } }),
      db.category.findUnique({ where: { id: updated.categoryId }, select: { name: true } })
    ]);
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "PRODUCT_UPDATE",
        entityType: "Product",
        entityId: params.id,
        metadata: {
          changed,
          name: updated.name,
          kind: updated.kind,
          brandId: updated.brandId,
          brandName: brand?.name ?? null,
          categoryId: updated.categoryId,
          categoryName: category?.name ?? null
        },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return updated;
  });

  app.delete("/:id", async (req, reply) => {
    requireAdmin(req);
    const params = validateParams(req, productIdParamsSchema, "Params inválidos");
    const before = await db.product.findUnique({ where: { id: params.id }, select: { id: true, name: true, kind: true } });
    await service.softDelete(params.id);

    const payload = (req.user ?? null) as JwtPayload | null;
    try {
      await audit.log({
        actorUserId: payload?.uid ?? null,
        action: "PRODUCT_DELETE",
        entityType: "Product",
        entityId: params.id,
        metadata: { name: before?.name ?? null, kind: before?.kind ?? null },
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
    } catch (err) {
      req.log.error({ err }, "Audit log failed");
    }

    return reply.status(204).send();
  });
};
