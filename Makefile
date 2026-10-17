PANDOC ?= pandoc
PYTHON ?= python3
POSTS := $(patsubst content/posts/%.md,posts/%.html,$(wildcard content/posts/*.md))

.DEFAULT_GOAL := all
.DELETE_ON_ERROR:

all: index.html $(POSTS)

index.html: templates/index.html log.json scripts/site.py
	$(PYTHON) scripts/site.py build-home --pandoc "$(PANDOC)"

posts/%.html: content/posts/%.md templates/post.html
	@mkdir -p posts
	$(PANDOC) --from=markdown --to=html5 --standalone --template=templates/post.html --toc --toc-depth=3 --section-divs --mathml --highlight-style=zenburn --output=$@ $<

# Arguments are passed through the environment, so Markdown/shell characters
# in TEXT are not interpolated into a shell command by the recipe.
export ID DATE TEXT

update-log log-update:
	$(PYTHON) scripts/site.py update-log
	$(MAKE) index.html

remove-log log-remove:
	$(PYTHON) scripts/site.py remove-log
	$(MAKE) index.html

log:
	$(PYTHON) scripts/site.py list-log

clean:
	rm -f $(POSTS)

.PHONY: all clean update-log log-update remove-log log-remove log
