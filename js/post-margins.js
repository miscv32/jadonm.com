(() => {
    const article = document.querySelector(".post article");
    if (!article) return;

    const wide = matchMedia("(min-width: 72rem) and (min-height: 31rem)");
    const controlSelector = "[data-figure-controls], .lens-diagram-switch, .j-lens-toolbar";
    const mediaSelector = "svg, img, iframe, object, embed";

    function isSvg(element) {
        const source = element.getAttribute("src") ?? element.getAttribute("data") ?? "";
        return element.matches('svg:not([aria-hidden="true"]), object[type="image/svg+xml"], embed[type="image/svg+xml"]')
            || /\.svg(?:[?#]|$)/i.test(source) || source.startsWith("data:image/svg+xml");
    }

    const figures = new Set();
    for (const visual of article.querySelectorAll(`[data-post-figure], ${mediaSelector}`)) {
        if (visual.closest(`details, ${controlSelector}`)) continue;
        if (visual.matches("[data-post-figure]")) {
            figures.add(visual);
        } else if (isSvg(visual)) {
            const container = visual.closest("[data-post-figure], figure, p");
            if (!container || !container.matches("p")) {
                figures.add(container ?? visual);
            } else if (!container.textContent.trim() && container.querySelectorAll(mediaSelector).length === 1) {
                figures.add(container);
            }
        }
    }

    const sections = new Set();
    const panels = Array.from(figures, (figure, index) => {
        const sibling = figure.previousElementSibling;
        const controls = sibling?.matches(controlSelector) ? sibling : null;
        const section = figure.closest("section");
        const marker = document.createElement("span");
        marker.className = "margin-figure-anchor";
        marker.hidden = true;
        (controls ?? figure).before(marker);
        const firstInSection = section && !sections.has(section);
        sections.add(section);
        figure.classList.add("margin-figure");
        controls?.classList.add("margin-figure-controls");
        return {
            elements: controls ? [controls, figure] : [figure],
            start: firstInSection ? section : !section && index === 0 ? article : marker,
            section,
            marker,
        };
    });

    const endnotes = article.querySelector(".footnotes-end-of-document");
    const notes = [];
    const seen = new Set();
    for (const reference of article.querySelectorAll("a.footnote-ref")) {
        const note = document.getElementById(reference.hash.slice(1));
        if (!endnotes?.contains(note) || seen.has(note)) continue;
        seen.add(note);
        notes.push({ reference, note });
    }
    // Keep the endnotes together if any lack a reference in the prose.
    const showNotes = notes.length && notes.length === endnotes.querySelectorAll(":scope > ol > li").length;
    if (!panels.length && !showNotes) return;
    article.classList.add("post-margins");
    if (showNotes) endnotes.classList.add("margin-notes");

    let activePanel;
    let notePadding = 0;
    let frame = 0;
    let layoutPending = false;
    const lastSection = panels.at(-1)?.section ?? article;

    function setActivePanel(next) {
        if (next === activePanel) return;
        for (const element of activePanel?.elements ?? []) {
            element.classList.remove("margin-figure-active");
            element.inert = true;
        }
        for (const element of next?.elements ?? []) {
            element.classList.add("margin-figure-active");
            element.inert = false;
        }
        activePanel = next;
    }

    function updatePanels() {
        const readingLine = window.innerHeight * 0.38;
        let next;
        if (lastSection.getBoundingClientRect().bottom > readingLine) {
            for (const panel of panels) {
                if (panel.start.getBoundingClientRect().top > readingLine) break;
                next = panel;
            }
        }
        setActivePanel(next);
    }

    function layoutMargins() {
        const rect = article.getBoundingClientRect();
        const gap = getComputedStyle(article).getPropertyValue("--post-gap").trim();
        if (panels.length) article.style.setProperty("--post-rail-left", `calc(${rect.right}px + ${gap})`);
        if (!showNotes) return;

        article.style.setProperty("--post-text-left", `${rect.left}px`);
        let bottom = 0;
        for (const { reference, note } of notes) {
            const top = Math.max(Math.round(reference.getBoundingClientRect().top - rect.top), bottom);
            note.style.top = `${top}px`;
            bottom = top + note.offsetHeight + 12;
        }
        notePadding = Math.max(0, bottom - (article.clientHeight - notePadding));
        article.style.paddingBottom = notePadding ? `${notePadding}px` : "";
    }

    function scheduleUpdate(layout = false) {
        if (!wide.matches) return;
        layoutPending ||= layout;
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (!wide.matches) return;
            if (layoutPending) layoutMargins();
            layoutPending = false;
            updatePanels();
        });
    }

    function updateMode() {
        for (const panel of panels) {
            panel.marker.hidden = !wide.matches;
            for (const element of panel.elements) {
                element.inert = wide.matches && panel !== activePanel;
            }
        }
        if (wide.matches) {
            scheduleUpdate(true);
        } else {
            activePanel = undefined;
            for (const panel of panels) {
                for (const element of panel.elements) element.classList.remove("margin-figure-active");
            }
            notePadding = 0;
            article.style.paddingBottom = "";
        }
    }

    wide.addEventListener("change", updateMode);
    window.addEventListener("scroll", () => scheduleUpdate(), { passive: true });
    window.addEventListener("resize", () => scheduleUpdate(true));
    const observer = new ResizeObserver(() => scheduleUpdate(true));
    observer.observe(article);
    if (showNotes) {
        for (const { note } of notes) observer.observe(note);
    }
    updateMode();
})();
