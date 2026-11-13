import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BreakdownRow, DashboardData } from "@/lib/dashboard";
import { riskLevel } from "@/lib/risk";

/**
 * The dashboard as a printed report, laid out like Synergetic's process documents: logo header on every page,
 * green numbered headings with thin green rules, pale-green table labels, and "Page X of Y" in the footer.
 * Only ever loaded on demand (see report-button.tsx), because @react-pdf/renderer is heavy.
 */

// Synergetic documents are set in Century Gothic, which is modelled on ITC Avant Garde. URW Gothic is the open-licensed Avant Garde,
// so it matches the look and can be embedded in the PDF. (Century Gothic itself is licensed and cannot be shipped with the app.)
const FONT = "URW Gothic";
const BOLD = { fontFamily: FONT, fontWeight: 700 } as const;
const ORIGIN = typeof window === "undefined" ? "" : window.location.origin;
Font.register({
  family: FONT,
  fonts: [
    { src: `${ORIGIN}/fonts/URWGothic-Book.otf`, fontWeight: 400 },
    { src: `${ORIGIN}/fonts/URWGothic-Demi.otf`, fontWeight: 700 },
  ],
});

// Never break a word with a hyphen: "Rat-ing" in a column header reads badly.
Font.registerHyphenationCallback((word) => [word]);

const GREEN = "#005b23";
const RULE = "#70ad47";
const PALE = "#c6e0b4";
const MUTED = "#5f5e5a";
const RED = "#d44c47";
const AMBER = "#d9992b";
const GREEN_BAND = "#3d935c";

const s = StyleSheet.create({
  page: { paddingTop: 96, paddingBottom: 56, paddingHorizontal: 50, fontFamily: FONT, fontSize: 10, color: "#111" },
  header: { position: "absolute", top: 28, left: 50, right: 50 },
  logo: { width: 84, height: 36 },
  footer: { position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "#111" },
  h1: { fontSize: 17, ...BOLD, color: GREEN, marginBottom: 12 },
  h2: { fontSize: 12, ...BOLD, marginTop: 18, marginBottom: 8 },
  p: { lineHeight: 1, marginBottom: 6 },
  note: { fontSize: 8.5, color: MUTED, marginTop: 6 },
  // Cover
  coverLogo: { width: 150, height: 64, alignSelf: "center", marginTop: 70 },
  rule: { borderTopWidth: 0.75, borderTopColor: RULE },
  coverBlock: { marginTop: 56 },
  coverTitle: { fontSize: 24, ...BOLD, color: GREEN, textAlign: "center", paddingVertical: 22 },
  coverSub: { fontSize: 14, ...BOLD, color: GREEN, textAlign: "center", paddingVertical: 14 },
  coverLine: { fontSize: 13, ...BOLD, textAlign: "center", paddingVertical: 13 },
  // Tables
  table: { borderTopWidth: 0.75, borderTopColor: RULE },
  tr: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: RULE, minHeight: 22, alignItems: "center" },
  th: { ...BOLD, fontSize: 9, backgroundColor: "#e7e6e6" },
  label: { backgroundColor: PALE, ...BOLD, paddingVertical: 6, paddingHorizontal: 8 },
  cell: { paddingVertical: 5, paddingHorizontal: 6 },
  bar: { flexDirection: "row", height: 6, gap: 1.5 },
  // KPI tiles
  kpis: { flexDirection: "row", gap: 8, marginBottom: 4 },
  kpi: { flex: 1, borderWidth: 0.75, borderColor: RULE, padding: 10 },
  kpiLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  kpiValue: { fontSize: 22, ...BOLD },
});

const bandColor = (rating: number) => ({ Low: GREEN_BAND, Medium: AMBER, High: RED })[riskLevel(rating)];
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function Cell({ w, children, bold, align, color }: { w: number | string; children: React.ReactNode; bold?: boolean; align?: "right" | "center"; color?: string }) {
  return (
    <View style={[s.cell, { width: w }]}>
      <Text style={{ textAlign: align, ...(bold ? BOLD : { fontFamily: FONT }), color }}>{children}</Text>
    </View>
  );
}

function Breakdown({ title, name, rows }: { title: string; name: string; rows: BreakdownRow[] }) {
  return (
    <View wrap={false}>
      <Text style={s.h2}>{title}</Text>
      <View style={s.table}>
        <View style={[s.tr, s.th]}>
          <Cell w="40%" bold>{name}</Cell>
          <Cell w="15%" bold align="center">High</Cell>
          <Cell w="15%" bold align="center">Medium</Cell>
          <Cell w="15%" bold align="center">Low</Cell>
          <Cell w="15%" bold align="center">Total</Cell>
        </View>
        {rows.map((r) => (
          <View key={r.id} style={s.tr} wrap={false}>
            <Cell w="40%">{r.name}</Cell>
            <Cell w="15%" align="center" color={r.high ? RED : MUTED}>{r.high}</Cell>
            <Cell w="15%" align="center">{r.medium}</Cell>
            <Cell w="15%" align="center">{r.low}</Cell>
            <Cell w="15%" align="center" bold>{r.total}</Cell>
          </View>
        ))}
      </View>
    </View>
  );
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).replace("Sept", "Sep") : "Never");

export interface ReportMeta {
  period: string;
  scope: string;
  preparedBy: string;
  generatedOn: string;
  /** Where the logo is loaded from; the browser default is fine, a file path is needed outside it. */
  logo?: string;
}

export function DashboardReport({ data, meta }: { data: DashboardData; meta: ReportMeta }) {
  const { levels, review, coverage, breakdown, top } = data;
  const logo = meta.logo ?? "/synergetic-logo.png";
  const chrome = (
    <>
      <View fixed style={s.header}>
        <Image src={logo} style={s.logo} />
      </View>
      <Text fixed style={s.footer} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </>
  );

  return (
    <Document title={`Risk Report, ${meta.period}`} author="Synergetic Development Group" subject="Enterprise Risk Register">
      {/* Cover */}
      <Page size="A4" style={[s.page, { paddingTop: 40 }]}>
        <Image src={logo} style={s.coverLogo} />
        <View style={[s.coverBlock, s.rule]}>
          <Text style={s.coverTitle}>Risk Report</Text>
          <View style={s.rule}><Text style={s.coverSub}>Enterprise Risk Register</Text></View>
          <View style={s.rule}><Text style={s.coverLine}>{meta.scope}</Text></View>
          <View style={s.rule} />
        </View>
        <View style={[s.table, { marginTop: 60 }]}>
          {[["Document Title", "Risk Report"], ["Reporting Period", meta.period], ["Scope", meta.scope], ["Prepared By", meta.preparedBy], ["Generated On", meta.generatedOn]].map(([k, v]) => (
            <View key={k} style={s.tr}>
              <View style={[s.label, { width: "36%" }]}><Text>{k}</Text></View>
              <View style={[s.cell, { width: "64%", paddingLeft: 8 }]}><Text style={BOLD}>{v}</Text></View>
            </View>
          ))}
        </View>
        <Text fixed style={s.footer} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>

      {/* Summary */}
      <Page size="A4" style={s.page}>
        {chrome}
        <Text style={s.h1}>1.0  Risk Summary</Text>
        <Text style={s.p}>
          This report summarises the risk register for {meta.scope} as at {meta.period}. Ratings are impact × likelihood, banded High (15 to 25),
          Medium (9 to 14) and Low (1 to 8)
        </Text>

        <View style={s.kpis}>
          {[
            ["Total risks", String(levels.total), "#111"],
            ["High", String(levels.high), RED],
            ["Medium", String(levels.medium), AMBER],
            ["Low", String(levels.low), GREEN_BAND],
          ].map(([label, value, color]) => (
            <View key={label} style={s.kpi}>
              <Text style={s.kpiLabel}>{label}</Text>
              <Text style={[s.kpiValue, { color }]}>{value}</Text>
              {label !== "Total risks" && <Text style={s.note}>{pct(Number(value), levels.total)}% of total</Text>}
            </View>
          ))}
        </View>

        <Text style={s.h2}>1.1  Review compliance</Text>
        <View style={s.table}>
          <View style={s.tr}><View style={[s.label, { width: "36%" }]}><Text>Reviewed in {meta.period}</Text></View><Cell w="64%" bold>{review.reviewed} of {review.total} risks ({pct(review.reviewed, review.total)}%)</Cell></View>
          <View style={s.tr}><View style={[s.label, { width: "36%" }]}><Text>Pending review</Text></View><Cell w="64%" bold>{review.pending} {review.pending === 1 ? "risk" : "risks"}</Cell></View>
        </View>

        <Text style={s.h2}>1.2  Mitigation coverage</Text>
        <View style={s.table}>
          <View style={s.tr}><View style={[s.label, { width: "36%" }]}><Text>With a mitigation plan</Text></View><Cell w="64%" bold>{coverage.withPlan} of {coverage.total} risks ({pct(coverage.withPlan, coverage.total)}%)</Cell></View>
          <View style={s.tr}><View style={[s.label, { width: "36%" }]}><Text>No mitigation plan</Text></View><Cell w="64%" bold>{coverage.noPlan} {coverage.noPlan === 1 ? "risk" : "risks"}</Cell></View>
        </View>
      </Page>

      {/* Breakdown */}
      <Page size="A4" style={s.page}>
        {chrome}
        <Text style={s.h1}>2.0  Risk Breakdown</Text>
        {!data.scoped && <Breakdown title="2.1  By department" name="Department" rows={breakdown.department} />}
        <Breakdown title={`${data.scoped ? "2.1" : "2.2"}  By category`} name="Category" rows={breakdown.category} />
        <Breakdown title={`${data.scoped ? "2.2" : "2.3"}  By division`} name="Division" rows={breakdown.division} />
      </Page>

      {/* Highest rated */}
      <Page size="A4" style={s.page}>
        {chrome}
        <Text style={s.h1}>3.0  Highest Rated Risks</Text>
        {top.length === 0 ? (
          <Text style={s.p}>There are no risks to show for this period.</Text>
        ) : (
          <View style={s.table}>
            <View style={[s.tr, s.th]}>
              <Cell w="8%" bold>ID</Cell>
              <Cell w="30%" bold>Risk</Cell>
              <Cell w="15%" bold>Department</Cell>
              <Cell w="9%" bold align="center">Rating</Cell>
              <Cell w="14%" bold>Owner</Cell>
              <Cell w="10%" bold>Status</Cell>
              <Cell w="14%" bold>Last review</Cell>
            </View>
            {top.map((r) => (
              <View key={r.id} style={s.tr} wrap={false}>
                <Cell w="8%">{r.code}</Cell>
                <Cell w="30%" bold>{r.title}</Cell>
                <Cell w="15%">{r.department}</Cell>
                <Cell w="9%" align="center" bold color={bandColor(r.rating)}>{r.rating}</Cell>
                <Cell w="14%">{r.owner ?? "Unassigned"}</Cell>
                <Cell w="10%">{r.archivedAt ? "Archived" : r.status === "closed" ? "Inactive" : "Active"}</Cell>
                <Cell w="14%">{fmtDate(r.lastReviewedAt)}</Cell>
              </View>
            ))}
          </View>
        )}
        {/* <Text style={s.note}>Generated from the Enterprise Risk Register on {meta.generatedOn}.</Text> */}
      </Page>
    </Document>
  );
}
