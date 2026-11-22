-- Render Markdown dropdowns as native HTML disclosure widgets.
function Div(div)
    if not div.classes:includes("dropdown") then
        return nil
    end

    local summary = div.attributes.summary
    assert(summary and summary:match("%S"), "A dropdown needs a nonempty summary")
    local label = pandoc.Pandoc({pandoc.Plain({pandoc.Str(summary)})})
    local escaped = pandoc.write(label, "html5", {wrap_text = "none"}):gsub("\n$", "")
    return {
        pandoc.RawBlock("html", '<details class="dropdown"><summary>' .. escaped .. '</summary>'),
        -- Keep Pandoc's generated sections inside the disclosure.
        pandoc.Div(div.content),
        pandoc.RawBlock("html", "</details>")
    }
end
