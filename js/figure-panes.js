(() => {
    function setupAverageEffects(slideshow, showSlide) {
        const [previous, next] = slideshow.querySelectorAll("button");
        const status = slideshow.querySelector("[role=status]");
        const steps = ["average-1", "average-2", "average-3", "average-4", "average"];
        let step = 0;

        function showStep() {
            const isMean = step === steps.length - 1;
            const title = isMean ? "Mean response" : `Context ${step + 1}`;
            showSlide(steps[step], `Average effects, ${title}`);
            previous.disabled = step === 0;
            next.disabled = isMean;
            status.textContent = `${step + 1} / ${steps.length}`;
        }

        for (const button of [previous, next]) {
            button.addEventListener("click", () => {
                step += Number(button.dataset.direction);
                showStep();
            });
        }
        return showStep;
    }

    for (const controls of document.querySelectorAll("[data-figure-panes]")) {
        const buttons = controls.querySelectorAll("button[data-slide]");
        const frame = document.getElementById(buttons[0].getAttribute("aria-controls"));
        const slideshow = controls.parentElement.querySelector("[data-slide-steps]");
        const message = controls.dataset.figureMessage;
        const showStep = slideshow && setupAverageEffects(slideshow, showSlide);
        let selected = controls.querySelector('[aria-pressed="true"]');

        function showSlide(fragment, title) {
            if (message) {
                frame.contentWindow.postMessage({ [message]: fragment }, "*");
            } else {
                const slide = new URL(frame.src);
                if (slide.hash !== `#${fragment}`) {
                    slide.hash = fragment;
                    frame.src = slide.href;
                }
            }
            frame.title = `${controls.dataset.figurePanes} diagram: ${title}`;
        }

        function selectPane(button) {
            selected = button;
            for (const pane of buttons) pane.setAttribute("aria-pressed", String(pane === button));
            const fragment = button.dataset.slide;
            const showSlideshow = fragment === slideshow?.dataset.slideSteps;
            if (slideshow) slideshow.hidden = !showSlideshow;
            if (showSlideshow) {
                showStep();
            } else {
                showSlide(fragment, button.textContent);
            }
        }

        for (const button of buttons) {
            button.addEventListener("click", () => selectPane(button));
        }
        if (message) frame.addEventListener("load", () => selectPane(selected));
        selectPane(selected);
        controls.hidden = false;
    }
})();
