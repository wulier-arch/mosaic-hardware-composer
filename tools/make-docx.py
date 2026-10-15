#!/usr/bin/env python3
"""
HTML → 标准 .docx（直接生成 OOXML）
为什么不用 textutil：macOS 的 textutil 会把 <table> 拍平成普通段落，标题也不带大纲级别，
生成出来的文档没有导航、表格也看不清。这里直接构造 OOXML，保证表格是真表格、标题有层级。
"""
import zipfile, re, sys, os
from html.parser import HTMLParser
from xml.sax.saxutils import escape

NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

# ---------- 字号（半磅）与颜色 ----------
STYLES = {
    'Title':      {'sz': 44, 'bold': True,  'before': 0,   'after': 120, 'color': '101014'},
    'Heading1':   {'sz': 30, 'bold': True,  'before': 400, 'after': 140, 'color': '101014'},
    'Heading2':   {'sz': 25, 'bold': True,  'before': 300, 'after': 100, 'color': '101014'},
    'Heading3':   {'sz': 23, 'bold': True,  'before': 240, 'after': 80,  'color': '4C2FBD'},
    'Normal':     {'sz': 21, 'bold': False, 'before': 0,   'after': 140, 'color': '101014'},
    'Lead':       {'sz': 23, 'bold': False, 'before': 0,   'after': 100, 'color': '4A4A50'},
    'Meta':       {'sz': 19, 'bold': False, 'before': 0,   'after': 320, 'color': '6A6A70'},
    'Box':        {'sz': 21, 'bold': False, 'before': 100, 'after': 200, 'color': '101014', 'shade': 'F2F1EE'},
    'ListPara':   {'sz': 21, 'bold': False, 'before': 0,   'after': 80,  'color': '101014'},
    'Code':       {'sz': 19, 'bold': False, 'before': 0,   'after': 140, 'color': '4C2FBD', 'mono': True},
}

def rpr(style, mono=False, bold=False):
    s = STYLES.get(style, STYLES['Normal'])
    fonts = ('<w:rFonts w:ascii="Menlo" w:hAnsi="Menlo" w:eastAsia="PingFang SC"/>'
             if (mono or s.get('mono')) else
             '<w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue" w:eastAsia="PingFang SC"/>')
    b = '<w:b/>' if (bold or s['bold']) else ''
    return (f'<w:rPr>{fonts}{b}'
            f'<w:color w:val="{s["color"]}"/><w:sz w:val="{s["sz"]}"/>'
            f'<w:szCs w:val="{s["sz"]}"/></w:rPr>')

def ppr(style, indent=0, bullet=None, ordered=None):
    s = STYLES.get(style, STYLES['Normal'])
    parts = [f'<w:pStyle w:val="{style}"/>']
    if bullet is not None or ordered is not None:
        parts.append(f'<w:ind w:left="{360 + indent * 360}" w:hanging="360"/>')
    elif indent:
        parts.append(f'<w:ind w:left="{indent * 360}"/>')
    parts.append(f'<w:spacing w:before="{s["before"]}" w:after="{s["after"]}" w:line="320" w:lineRule="auto"/>')
    if s.get('shade'):
        parts.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{s["shade"]}"/>')
    if bullet is not None:
        parts.append('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')
    elif ordered is not None:
        parts.append('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>')
    return '<w:pPr>' + ''.join(parts) + '</w:pPr>'

def para(runs, style='Normal', indent=0, bullet=None, ordered=None):
    return f'<w:p>{ppr(style, indent, bullet, ordered)}{runs}</w:p>'

def run(text, style='Normal', bold=False, mono=False):
    if text == '':
        return ''
    return (f'<w:r>{rpr(style, mono, bold)}'
            f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r>')

def line_break():
    return '<w:r><w:br/></w:r>'

# ---------- 表格 ----------
def cell(content_runs, width, header=False, style='Normal'):
    shd = '<w:shd w:val="clear" w:color="auto" w:fill="F2F1EE"/>' if header else ''
    return (f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{shd}'
            f'<w:vAlign w:val="top"/></w:tcPr>'
            f'<w:p>{ppr(style)}'
            + (''.join(content_runs) if content_runs else run('', style))
            + '</w:p></w:tc>')

def table(rows, widths):
    total = sum(widths)
    out = ['<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>'
           '<w:tblBorders>'
           + ''.join(f'<w:{e} w:val="single" w:sz="4" w:space="0" w:color="D8D6D0"/>'
                     for e in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))
           + '</w:tblBorders>'
           '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>'
           '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>'
           '</w:tblPr>'
           '<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{int(w / total * 9000)}"/>' for w in widths) + '</w:tblGrid>']
    for ri, row in enumerate(rows):
        out.append('<w:tr>')
        if ri == 0:
            out.append('<w:trPr><w:tblHeader/></w:trPr>')
        for ci, c in enumerate(row):
            out.append(cell(c, int(widths[ci] / total * 9000), header=(ri == 0)))
        out.append('</w:tr>')
    out.append('</w:tbl>')
    out.append(para(run('', 'Normal')))          # 表后留空段
    return ''.join(out)

# ---------- HTML 解析 ----------
class Doc(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.body = []
        self.stack = []            # 当前块级容器
        self.inline = []           # 当前段落的 runs
        self.buf = []
        self.list_stack = []       # 'ul' / 'ol'
        self.in_table = 0
        self.table_rows = []
        self.table_row = None
        self.in_cell = 0
        self.cell_runs = []
        self.para_style = 'Normal'
        self.para_class = ''

    # ---- 文本 ----
    def handle_data(self, data):
        self.buf.append(data)

    def _flush_text(self, bold=False, mono=False):
        text = ''.join(self.buf)
        self.buf = []
        text = re.sub(r'\s+', ' ', text)
        if text.strip() == '' and not text:
            return
        target = self.cell_runs if self.in_cell else self.inline
        target.append(run(text, self.para_style, bold, mono))

    # ---- 标签 ----
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get('class', '')

        if tag in ('h1', 'h2', 'h3', 'h4'):
            self.para_style = {'h1': 'Title', 'h2': 'Heading1', 'h3': 'Heading2', 'h4': 'Heading3'}[tag]
            self.inline = []
        elif tag == 'p':
            self.para_style = 'Meta' if 'meta' in cls else ('Lead' if 'lead' in cls else ('Box' if 'box' in cls else 'Normal'))
            self.para_class = cls
            self.inline = []
        elif tag in ('ul', 'ol'):
            self.list_stack.append(tag)
        elif tag == 'li':
            self.para_style = 'ListPara'
            self.inline = []
        elif tag == 'table':
            self.in_table += 1
            self.table_rows = []
        elif tag == 'tr':
            self.table_row = []
        elif tag in ('td', 'th'):
            self.in_cell += 1
            self.cell_runs = []
        elif tag in ('strong', 'b'):
            self._flush_text()
            self.buf = []
            self._pending_bold = True
        elif tag == 'code':
            self._flush_text()
            self._pending_mono = True
        elif tag == 'br':
            target = self.cell_runs if self.in_cell else self.inline
            target.append(line_break())

    def handle_endtag(self, tag):
        if tag in ('strong', 'b'):
            text = ''.join(self.buf); self.buf = []
            if text:
                target = self.cell_runs if self.in_cell else self.inline
                target.append(run(re.sub(r'\s+', ' ', text), self.para_style, True))
        elif tag == 'code':
            text = ''.join(self.buf); self.buf = []
            if text:
                target = self.cell_runs if self.in_cell else self.inline
                target.append(run(re.sub(r'\s+', ' ', text), 'Code', False, True))
        elif tag in ('h1', 'h2', 'h3', 'h4', 'p', 'li'):
            self._flush_text()
            self.body.append(para(''.join(self.inline), self.para_style,
                                  indent=len(self.list_stack) - 1 if self.list_stack else 0,
                                  bullet=True if (self.list_stack and self.list_stack[-1] == 'ul') else None,
                                  ordered=True if (self.list_stack and self.list_stack[-1] == 'ol') else None))
            self.inline = []
            self.para_style = 'Normal'
        elif tag in ('ul', 'ol'):
            if self.list_stack:
                self.list_stack.pop()
        elif tag in ('td', 'th'):
            self._flush_text()
            self.table_row.append(self.cell_runs)
            self.cell_runs = []
            self.in_cell -= 1
        elif tag == 'tr':
            self.table_rows.append(self.table_row)
            self.table_row = None
        elif tag == 'table':
            widths = [1] * len(self.table_rows[0])
            # 第一列窄、其余宽
            if len(widths) == 4:
                widths = [0.9, 2.0, 1.3, 6.0]
            elif len(widths) == 2:
                widths = [2.6, 7.4]
            elif len(widths) == 3:
                widths = [2.0, 2.0, 6.0]
            self.body.append(table(self.table_rows, widths))
            self.table_rows = []
            self.in_table -= 1
        elif tag == 'body':
            pass


def build_docx(html_path, out_path, title='MOSAIC 拼造 · 参赛说明文档'):
    html = open(html_path, encoding='utf-8').read()
    # 去掉 style / head
    html = re.sub(r'<style.*?</style>', '', html, flags=re.S)
    html = re.sub(r'<head.*?</head>', '', html, flags=re.S)

    d = Doc()
    d.feed(html)
    body_xml = ''.join(d.body)

    sect = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
            '<w:pgMar w:top="1418" w:right="1276" w:bottom="1418" w:left="1276" '
            'w:header="851" w:footer="992" w:gutter="0"/></w:sectPr>')

    document = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                f'<w:document {NS}><w:body>{body_xml}{sect}</w:body></w:document>')

    styles = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles {NS}>
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue" w:eastAsia="PingFang SC"/>
<w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
''' + ''.join(
        f'<w:style w:type="paragraph" w:styleId="{sid}"><w:name w:val="{sid}"/>'
        f'<w:basedOn w:val="Normal"/><w:qFormat/>'
        f'<w:rPr><w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue" w:eastAsia="PingFang SC"/>'
        f'<w:b w:val="{"true" if s["bold"] else "false"}"/><w:color w:val="{s["color"]}"/>'
        f'<w:sz w:val="{s["sz"]}"/><w:szCs w:val="{s["sz"]}"/></w:rPr></w:style>'
        for sid, s in STYLES.items()
    ) + '''
<w:style w:type="paragraph" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="numbering" w:styleId="ListBullet"><w:name w:val="List Bullet"/></w:style>
</w:styles>'''

    numbering = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering {NS}>
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>
<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue" w:hint="default"/></w:rPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>
<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>'''

    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''

    doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>'''

    core = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>{escape(title)}</dc:title><dc:creator>雾削木 WuXiaoMuer</dc:creator>
<cp:lastModifiedBy>雾削木 WuXiaoMuer</cp:lastModifiedBy></cp:coreProperties>'''

    app = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>MOSAIC DocGen</Application></Properties>'''

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types)
        z.writestr('_rels/.rels', rels)
        z.writestr('word/document.xml', document)
        z.writestr('word/styles.xml', styles)
        z.writestr('word/numbering.xml', numbering)
        z.writestr('word/_rels/document.xml.rels', doc_rels)
        z.writestr('docProps/core.xml', core)
        z.writestr('docProps/app.xml', app)
    return out_path


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    build_docx(src, dst)
    size = os.path.getsize(dst)
    print(f'生成 {dst}  ({size/1024:.1f} KB)')
