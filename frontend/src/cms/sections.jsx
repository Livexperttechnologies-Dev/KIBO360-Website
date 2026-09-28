import { Children, cloneElement, isValidElement } from "react";
import { useCms, useScope } from "./content.jsx";
import { Sec } from "./primitives.jsx";
import { BLOCKS } from "./blocks.jsx";

/**
 * Orders a page's sections according to its CMS layout: reordering, hiding,
 * duplicating built-in sections and inserting new blocks from the library.
 * Children must be <Sec id="..."> elements (the page's default order).
 */
export function Sections({ children }) {
  const { docs } = useCms();
  const { docId } = useScope();
  const layout = docs[docId]?.layout || {};
  const kids = Children.toArray(children).filter((k) => isValidElement(k) && k.props.id);
  const byId = new Map(kids.map((k) => [k.props.id, k]));
  const defaults = kids.map((k) => k.props.id);
  const dups = layout.dups || {};
  const blocks = layout.blocks || {};

  const order = [];
  const seen = new Set();
  for (const id of layout.order || []) {
    if (seen.has(id)) continue;
    if (blocks[id] || byId.has(dups[id] || id)) { order.push(id); seen.add(id); }
  }
  // Sections added in code later appear next to their original neighbour.
  defaults.forEach((id, i) => {
    if (seen.has(id)) return;
    const prev = defaults.slice(0, i).reverse().find((p) => seen.has(p));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, id);
    seen.add(id);
  });

  return order.map((id) => {
    const hidden = !!layout.hidden?.[id];
    const block = blocks[id];
    if (block) {
      const def = BLOCKS[block.type];
      if (!def) return null;
      const C = def.Component;
      return (
        <Sec key={id} id={id} hidden={hidden} label={def.label} block={block.type}>
          <C block={block} />
        </Sec>
      );
    }
    return cloneElement(byId.get(dups[id] || id), { key: id, instanceId: id, hidden });
  });
}

/** Default section order of a page (used by the admin structure panel). */
export function sectionIdsOf(children) {
  return Children.toArray(children).filter((k) => isValidElement(k) && k.props.id).map((k) => k.props.id);
}
