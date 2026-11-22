(() => {
    const article = document.querySelector(".post article");
    if (!article) return;

    const wide = matchMedia("(min-width: 72rem) and (min-height: 31rem)");
    const controlSelector = "[data-figure-controls]";
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

    const firstSection = article.querySelector("section");
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
    const hasSidenotes = notes.length > 0 && notes.length === endnotes.querySelectorAll(":scope > ol > li").length;
    if (!panels.length && !hasSidenotes) return;
    article.classList.add("post-margins");

    const layoutControls = article.querySelector(".post-layout-controls");
    const figureSelect = layoutControls?.querySelector("select");

    let activePanel;
    let showRailFigures = false;
    let showSidenotes = false;
    let notePadding = 0;
    let frame = 0;
    let layoutPending = false;

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
        const viewportHeight = window.innerHeight;
        const readingLine = viewportHeight * 0.38;
        const inIntroduction = !firstSection || firstSection.getBoundingClientRect().top > readingLine;
        let next;
        for (const panel of panels) {
            if (panel.start.getBoundingClientRect().top > readingLine) break;
            if (!panel.section && !inIntroduction) continue;
            const { top, bottom } = (panel.section ?? article).getBoundingClientRect();
            if (bottom > 0 && top < viewportHeight) {
                next = panel;
            }
        }
        setActivePanel(next);
    }

    function layoutMargins() {
        const rect = article.getBoundingClientRect();
        const gap = getComputedStyle(article).getPropertyValue("--post-gap").trim();
        if (showRailFigures) article.style.setProperty("--post-rail-left", `calc(${rect.right}px + ${gap})`);
        if (!showSidenotes) return;

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
        if (!showRailFigures && !showSidenotes) return;
        layoutPending ||= layout;
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (layoutPending && (showRailFigures || showSidenotes)) layoutMargins();
            layoutPending = false;
            if (showRailFigures) updatePanels();
        });
    }

    function updateMode() {
        showRailFigures = wide.matches && panels.length > 0 && figureSelect?.value === "slideshow";
        showSidenotes = wide.matches && hasSidenotes;
        if (layoutControls) layoutControls.hidden = !wide.matches || !panels.length;
        article.classList.toggle("post-rail-figures", showRailFigures);
        endnotes?.classList.toggle("margin-notes", showSidenotes);

        if (!showRailFigures) setActivePanel(undefined);
        for (const panel of panels) {
            panel.marker.hidden = !showRailFigures;
            for (const element of panel.elements) {
                element.inert = showRailFigures && panel !== activePanel;
            }
        }
        if (!showSidenotes) {
            notePadding = 0;
            article.style.paddingBottom = "";
        }
        scheduleUpdate(true);
    }

    figureSelect?.addEventListener("change", updateMode);
    wide.addEventListener("change", updateMode);
    window.addEventListener("scroll", () => scheduleUpdate(), { passive: true });
    window.addEventListener("resize", () => scheduleUpdate(true));
    const observer = new ResizeObserver(() => scheduleUpdate(true));
    observer.observe(article);
    if (hasSidenotes) {
        for (const { note } of notes) observer.observe(note);
    }
    updateMode();
})();
