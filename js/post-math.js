for (const operator of document.querySelectorAll(".post math mo")) {
    const symbol = operator.textContent.trim();
    const form = operator.getAttribute("form");

    if (symbol === "\u0302" && operator.matches('mover > mi + mo[accent="true"]:last-child')) {
        // A spacing caret centers over a single identifier in Latin Modern Math.
        operator.parentElement.setAttribute("accent", "true");
        operator.removeAttribute("accent");
        operator.setAttribute("stretchy", "false");
        operator.textContent = "^";
    } else if (symbol === "(" && form === "prefix") {
        operator.classList.add("math-opening-parenthesis");
    } else if (symbol === ")" && form === "postfix") {
        operator.classList.add("math-closing-parenthesis");
    } else if (symbol === "|" && form === "prefix") {
        operator.classList.add("math-opening-bar");
    } else if (symbol === "|" && form === "postfix") {
        operator.classList.add("math-closing-bar");
    } else if (symbol === "‖" && !form && operator.previousElementSibling && operator.nextElementSibling) {
        // Pandoc emits the double bar without its TeX binary-operator spacing.
        operator.setAttribute("form", "infix");
        operator.setAttribute("stretchy", "false");
        operator.setAttribute("lspace", "0.222em");
        operator.setAttribute("rspace", "0.222em");
    }
}

function limitJustifiedSpacing(paragraph) {
    const oldBreaks = paragraph.querySelectorAll(".math-paragraph-break");
    for (const marker of oldBreaks) marker.remove();
    if (oldBreaks.length) paragraph.normalize();

    const style = getComputedStyle(paragraph);
    if (style.textAlign !== "justify") return;

    const maxSpace = parseFloat(style.fontSize) * 0.8;
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const range = new Range();
    const breaks = [];
    let wideSpace;

    for (let node; (node = walker.nextNode());) {
        if (node.parentElement.closest("math")) continue;
        for (const space of node.data.matchAll(/[ \t\n\r\f]+/g)) {
            range.setStart(node, space.index);
            range.setEnd(node, space.index + space[0].length);
            const rect = range.getClientRects()[0];
            if (!rect) continue;
            if (rect.width > maxSpace) {
                wideSpace = rect;
            } else if (wideSpace && rect.width < 0.5 &&
                Math.abs(rect.y - wideSpace.y) < 2 && rect.x >= wideSpace.right - 1) {
                // A collapsed space after the stretched words marks the soft line break.
                breaks.push({ node, offset: space.index });
                wideSpace = undefined;
            }
        }
    }

    // Work backward so inserting a marker cannot invalidate an earlier text offset.
    for (const { node, offset } of breaks.reverse()) {
        const marker = document.createElement("span");
        marker.className = "math-paragraph-break";
        marker.setAttribute("aria-hidden", "true");
        range.setStart(node, offset);
        range.collapse(true);
        range.insertNode(marker);
    }
}

const mathParagraphs = document.querySelectorAll('.post article p:has(math[display="inline"])');
if (mathParagraphs.length) {
    const widths = new WeakMap();
    const observer = new ResizeObserver(entries => {
        for (const { target, contentRect } of entries) {
            if (widths.get(target) === contentRect.width) continue;
            widths.set(target, contentRect.width);
            requestAnimationFrame(() => limitJustifiedSpacing(target));
        }
    });
    for (const paragraph of mathParagraphs) observer.observe(paragraph);
    document.fonts.ready.then(() => {
        for (const paragraph of mathParagraphs) limitJustifiedSpacing(paragraph);
    });
}
