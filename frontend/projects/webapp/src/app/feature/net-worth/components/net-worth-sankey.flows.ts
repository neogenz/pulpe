import type { NetWorth } from 'pulpe-shared';
import { debtGroups, ownGroups } from './net-worth-groups';

export type SankeyNodeKind =
  | 'category'
  | 'gross'
  | 'net'
  | 'shortfall'
  | 'debt'
  | 'overdrafts';

export interface SankeyFlow {
  from: string;
  to: string;
  flow: number;
}

export interface SankeyNode {
  kind: SankeyNodeKind;
  /** `null` for the fixed nodes, which the chart labels itself. */
  name: string | null;
  /** What the node is worth in base currency, for its label. */
  value: number;
}

export interface NetWorthSankey {
  flows: SankeyFlow[];
  nodes: Record<string, SankeyNode>;
  /** Pins a node to a column when the flows alone would misplace it. */
  columns: Record<string, number>;
  /** Orders nodes inside a column, lowest on top; empty keeps the default. */
  priorities: Record<string, number>;
}

export const GROSS_NODE = 'gross';
export const NET_NODE = 'net';

/**
 * Maps the figures of the page to flow widths. Each Type I own flows into
 * gross; gross leaves on the debts side, one node per debt Type plus one for
 * the overdrawn accounts, and into a Fortune nette node when net is positive.
 * Elements are not drawn: the lists carry them, and the chart stays readable
 * however many there are. When the debts exceed gross, a negative Fortune
 * nette node beside gross covers the rest of each debt, so every column keeps
 * the same scale and a debt is drawn at its real size. Nothing is returned
 * when there is nothing to split: a single Type and no debt.
 */
export function buildNetWorthSankey({
  totals,
  categories,
  assets,
}: NetWorth): NetWorthSankey {
  const flows: SankeyFlow[] = [];
  const nodes: NetWorthSankey['nodes'] = {};
  const empty = { flows, nodes, columns: {}, priorities: {} };
  if (totals.gross <= 0) return empty;

  const active = assets.filter((asset) => asset.archivedAt === null);
  const owned = ownGroups(categories, active).filter(
    (group) => group.total > 0,
  );
  const debts = debtGroups(categories, active).filter(
    (group) => group.total > 0,
  );
  if (owned.length <= 1 && debts.length === 0) return empty;

  for (const { category, total } of owned) {
    const id = `category:${category.id}`;
    nodes[id] = { kind: 'category', name: category.name, value: total };
    flows.push({ from: id, to: GROSS_NODE, flow: total });
  }

  // Share of each debt that gross covers; the shortfall covers the rest.
  const covered = totals.net < 0 ? totals.gross / totals.debts : 1;
  for (const { category, total } of debts) {
    const id = category ? `debt:${category.id}` : 'debt:overdrafts';
    nodes[id] = category
      ? { kind: 'debt', name: category.name, value: total }
      : { kind: 'overdrafts', name: null, value: total };
    flows.push({ from: GROSS_NODE, to: id, flow: total * covered });
    if (covered < 1) {
      flows.push({ from: NET_NODE, to: id, flow: total * (1 - covered) });
    }
  }

  nodes[GROSS_NODE] = { kind: 'gross', name: null, value: totals.gross };
  if (totals.net > 0) {
    nodes[NET_NODE] = { kind: 'net', name: null, value: totals.net };
    flows.push({ from: GROSS_NODE, to: NET_NODE, flow: totals.net });
  }
  if (totals.net < 0) {
    // « Il manque » reads as a magnitude, like the debts it covers.
    nodes[NET_NODE] = {
      kind: 'shortfall',
      name: null,
      value: Math.abs(totals.net),
    };
    // Without inflows the chart would start it in the first column; it sits
    // beside gross, right after the Types, and under it so the main flow
    // stays on top.
    return {
      flows,
      nodes,
      columns: { [NET_NODE]: 1 },
      priorities: { [GROSS_NODE]: 0, [NET_NODE]: 1 },
    };
  }

  return { flows, nodes, columns: {}, priorities: {} };
}
