-- Let wide tables scroll within the article column.
function Table(table_block)
    return pandoc.Div({table_block}, pandoc.Attr("", {"table-scroll"}, {tabindex = "0"}))
end
