# interactive figures

## visual style

- Match the surrounding page's typography and palette. Use a consistent visual vocabulary across related figures, including reading direction, symbols, line weights, and spacing. Use contrast and colour to show which elements matter in the current view.
- Choose the form that conveys the idea directly. Draw relationships and operations, and use tables for exact comparisons. Keep labels for information the visual cannot convey on its own.
- Give related panes consistent spacing around visible content and controls. Fit the frame to its contents, allow the page to reflow, and keep the drawing's scale stable as the frame changes size.
- Keep controls in the page HTML so they can align with the surrounding text and adapt to narrow screens. Use recognisable controls with accessible names, keyboard support, visible focus, and clear selected or disabled states. Give the figure a title and an accessible description of the information it conveys.
- Put each SVG in a standalone element or a figure. Put its controls in the preceding element and mark that element with `data-figure-controls`. The post template places both in the right margin on wide screens and keeps them inline on small screens. Use `data-post-figure` to mark a custom figure wrapper.

## transitions

- Use the timing and easing defaults in `figure-motion.css` for related figures. Use fades for changes in emphasis or content. Use movement when it helps the reader track a shared element between states.
- Let readers step through explanations at their own pace. When a layout changes, keep stable landmarks in place where possible. Fade outgoing elements before moving anything they could overlap, then reveal replacements when the new layout is ready.
- Coordinate frame resizing with the drawing. Let a frame grow ahead of incoming content and shrink after outgoing content clears its edge. For a view that appears in place, set the frame size before revealing it.
- Respect `prefers-reduced-motion` by showing the new state immediately. Check each starting state, both directions of each transition, rapid interactions, and narrow widths. Check intermediate frames for clipping, overlap, and stray movement.

## labels and prose

- Use short, lowercase figure labels and British spelling. Preserve the case of variables, proper nouns, acronyms, and quoted text. Separate a trailing variable from its label with a comma where it names the labelled quantity.
- Keep existing post prose verbatim unless a prose edit is explicitly requested.
