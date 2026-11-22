-- Render Markdown dropdowns as native HTML disclosure widgets.
function Div(div)
    if not div.classes:includes("dropdown") then
        return nil
    end

    local summary = div.attributes.summary
    assert(summary and summary:match("%S"), "A dropdown needs a nonempty summary")
    local label = pandoc.List({pandoc.Str(summary)})
    if summary:find("$", 1, true) then
        local blocks = pandoc.read(summary, "markdown-raw_html-raw_tex-smart").blocks
        if #blocks == 1 and (blocks[1].tag == "Para" or blocks[1].tag == "Plain") then
            label = blocks[1].content
        end
    end
    label:insert(1, pandoc.RawInline("html", "<summary>"))
    label:insert(pandoc.RawInline("html", "</summary>"))
    return {
        pandoc.RawBlock("html", '<details class="dropdown">'),
        pandoc.Plain(label),
        -- Keep Pandoc's generated sections inside the disclosure.
        pandoc.Div(div.content),
        pandoc.RawBlock("html", "</details>")
    }
end
