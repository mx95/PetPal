<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>PetPal Care Hub sitemap</title>
        <style type="text/css">
          body { font-family: system-ui, -apple-system, sans-serif; margin: 1.25rem; color: #0f172a; line-height: 1.45; }
          h1 { font-size: 1.25rem; margin: 0 0 0.35rem; }
          p { color: #475569; margin: 0 0 1rem; max-width: 42rem; }
          table { border-collapse: collapse; width: 100%; max-width: 56rem; }
          th, td { border: 1px solid #e2e8f0; padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }
          th { background: #f8fafc; font-size: 0.85rem; }
          td { font-size: 0.9rem; word-break: break-all; }
          a { color: #0f766e; }
        </style>
      </head>
      <body>
        <h1>PetPal Care Hub — sitemap</h1>
        <p>
          This is a machine-readable sitemap for search engines. The XML source uses
          <code>&lt;url&gt;</code>, <code>&lt;loc&gt;</code>, and related elements from the
          sitemaps.org 0.9 schema. Search crawlers read the raw XML; this table is only for browsers.
        </p>
        <table>
          <thead>
            <tr>
              <th>loc</th>
              <th>lastmod</th>
              <th>changefreq</th>
              <th>priority</th>
            </tr>
          </thead>
          <tbody>
            <xsl:for-each select="sm:urlset/sm:url">
              <tr>
                <td>
                  <a href="{sm:loc}">
                    <xsl:value-of select="sm:loc"/>
                  </a>
                </td>
                <td><xsl:value-of select="sm:lastmod"/></td>
                <td><xsl:value-of select="sm:changefreq"/></td>
                <td><xsl:value-of select="sm:priority"/></td>
              </tr>
            </xsl:for-each>
          </tbody>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
