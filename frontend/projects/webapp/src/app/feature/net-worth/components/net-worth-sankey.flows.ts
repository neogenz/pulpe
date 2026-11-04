import type { Asset, NetWorth } from 'pulpe-shared';

export type SankeyNodeKind =
  | 'asset'
  | 'category'
  | 'gross'
  | 'net'
  | 'shortfall'
  | 'debt';

export interface SankeyFlow {
  from: string;
  to: string;
  flow: number;
}

export interface SankeyNode {
  kind: SankeyNodeKind;
  /** `null` for the two fixed nodes, which the chart labels itself. */
  name: string | null;
  /** What the node is worth in base currency, for its label. */
  value: number;
}

export interface NetWorthSankey {
  flows: SankeyFlow[];
  nodes: Record<string, SankeyNode>;
  /** Pins a node to a column when the flows alone would misplace it. */
  columns: Record<string, number>;
}

export const GROSS_NODE = 'gross';
export const NET_NODE = 'net';

/**
 * Maps the figures the API computed to flow widths: no money is computed here.
 * Positive `own` assets flow into their category, then into gross; the
 * category column is left out when every category holds a single asset, since
 * it would only repeat the assets. `owe` assets and overdrawn `own` assets
 * leave gross on the debts side, into a Fortune nette node when net is
 * positive. When the debts exceed gross, a negative Fortune nette node beside
 * gross covers the rest of each debt, so every column keeps the same scale and
 * a debt is drawn at its real size.
 */
export function buildNetWorthSankey({
  totals,
  categories,
  assets,
}: NetWorth): NetWorthSankey {
  const flows: SankeyFlow[] = [];
  const nodes: NetWorthSankey['nodes'] = {};
  if (totals.gross <= 0) return { flows, nodes, columns: {} };

  // Share of each debt that gross covers; the shortfall covers the rest.
  const covered = totals.net < 0 ? totals.gross / totals.debts : 1;
  const owned = assets.filter(
    (asset): asset is Asset & { convertedValue: number } =>
      asset.archivedAt === null &&
      asset.direction === 'own' &&
      asset.convertedValue !== null &&
      asset.convertedValue > 0,
  );
  const categoryIds = new Set(owned.map((asset) => asset.categoryId));
  const hasCategoryColumn = categoryIds.size < owned.length;

  for (const asset of owned) {
    const id = `asset:${asset.id}`;
    const value = asset.convertedValue;
    nodes[id] = { kind: 'asset', name: asset.name, value };
    const to = hasCategoryColumn ? `category:${asset.categoryId}` : GROSS_NODE;
    flows.push({ from: id, to, flow: value });
  }

  for (const asset of assets) {
    const value = asset.convertedValue;
    if (asset.archivedAt !== null || value === null) continue;

    if (value !== 0 && (asset.direction === 'owe' || value < 0)) {
      const id = `debt:${asset.id}`;
      const magnitude = Math.abs(value);
      nodes[id] = { kind: 'debt', name: asset.name, value: magnitude };
      flows.push({ from: GROSS_NODE, to: id, flow: magnitude * covered });
      if (covered < 1) {
        flows.push({ from: NET_NODE, to: id, flow: magnitude * (1 - covered) });
      }
    }
  }

  for (const category of categories) {
    if (!hasCategoryColumn || !categoryIds.has(category.id)) continue;
    const id = `category:${category.id}`;
    nodes[id] = {
      kind: 'category',
      name: category.name,
      value: category.total,
    };
    flows.push({ from: id, to: GROSS_NODE, flow: category.total });
  }

  nodes[GROSS_NODE] = { kind: 'gross', name: null, value: totals.gross };
  if (totals.net > 0) {
    nodes[NET_NODE] = { kind: 'net', name: null, value: totals.net };
    flows.push({ from: GROSS_NODE, to: NET_NODE, flow: totals.net });
  }
  if (totals.net < 0) {
    nodes[NET_NODE] = { kind: 'shortfall', name: null, value: totals.net };
    // Without inflows the chart would start it in the first column; it sits
    // beside gross, right after the assets (and their categories).
    const grossColumn = hasCategoryColumn ? 2 : 1;
    return { flows, nodes, columns: { [NET_NODE]: grossColumn } };
  }

  return { flows, nodes, columns: {} };
}
