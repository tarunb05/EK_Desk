"use server";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  getAllFeeAccountRecords,
  type RecordScopeParams,
} from "@/lib/records/queries";
import { paiseToRupees } from "@/lib/domain/money";
import type { FeeAccountRecordRow } from "@/lib/records/types";
import { createClient } from "@/lib/supabase/server";

// react-pdf's built-in fonts (the PDF standard 14) don't include the ₹
// glyph, and embedding a custom font means fetching one at request time —
// "Rs." keeps this self-contained and avoids that fragility for a first
// version.
const inrGroupingFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

function formatPaiseForPdf(paise: bigint): string {
  return `Rs. ${inrGroupingFormatter.format(paiseToRupees(paise))}`;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#57544E", marginBottom: 14 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1C1B19",
    paddingBottom: 4,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E3E2E1",
    paddingVertical: 4,
  },
  headerCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#57544E",
  },
  cell: { fontSize: 9 },
  colStudent: { width: "22%" },
  colClass: { width: "12%" },
  colGroup: { width: "17%" },
  colMoney: { width: "12%", textAlign: "right" },
  colDate: { width: "12%", textAlign: "right" },
  colStatus: { width: "13%", textAlign: "right" },
});

function RecordsDocument({
  rows,
  title,
  subtitle,
  groupLabel,
}: {
  rows: FeeAccountRecordRow[];
  title: string;
  subtitle: string;
  groupLabel: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.colStudent]}>Student</Text>
          <Text style={[styles.headerCell, styles.colClass]}>Class</Text>
          <Text style={[styles.headerCell, styles.colGroup]}>{groupLabel}</Text>
          <Text style={[styles.headerCell, styles.colMoney]}>Receivable</Text>
          <Text style={[styles.headerCell, styles.colMoney]}>Collected</Text>
          <Text style={[styles.headerCell, styles.colMoney]}>Pending</Text>
          <Text style={[styles.headerCell, styles.colDate]}>Due date</Text>
          <Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
        </View>

        {rows.map((row) => (
          <View style={styles.row} key={row.feeAccountId} wrap={false}>
            <Text style={[styles.cell, styles.colStudent]}>
              {row.studentFullName}
            </Text>
            <Text style={[styles.cell, styles.colClass]}>
              {row.classSection}
            </Text>
            <Text style={[styles.cell, styles.colGroup]}>
              {row.routeName ?? row.slot ?? "-"}
            </Text>
            <Text style={[styles.cell, styles.colMoney]}>
              {formatPaiseForPdf(row.totalReceivablePaise)}
            </Text>
            <Text style={[styles.cell, styles.colMoney]}>
              {formatPaiseForPdf(row.collectedPaise)}
            </Text>
            <Text style={[styles.cell, styles.colMoney]}>
              {formatPaiseForPdf(row.pendingPaise)}
            </Text>
            <Text style={[styles.cell, styles.colDate]}>{row.dueDate}</Text>
            <Text style={[styles.cell, styles.colStatus]}>{row.status}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function exportRecordsPdf(
  params: RecordScopeParams & { yearLabel: string; branchLabel: string },
): Promise<string> {
  const supabase = await createClient();
  const rows = await getAllFeeAccountRecords(supabase, params);

  const serviceLabel =
    params.serviceType === "transport" ? "Transport" : "Daycare";
  const groupLabel = params.serviceType === "transport" ? "Route" : "Slot";
  const title = `${serviceLabel} Records`;
  const subtitle = `${params.yearLabel} · ${params.branchLabel} · generated ${new Date().toISOString().slice(0, 10)}`;

  const buffer = await renderToBuffer(
    <RecordsDocument
      rows={rows}
      title={title}
      subtitle={subtitle}
      groupLabel={groupLabel}
    />,
  );

  return buffer.toString("base64");
}
