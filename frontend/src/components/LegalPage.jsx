import Seo from "./Seo.jsx";
import { PageDoc } from "../cms/content.jsx";
import { T, R, Sec } from "../cms/primitives.jsx";
import { Sections } from "../cms/sections.jsx";

/**
 * Long-form legal page: title, "last updated" line and one rich-text body
 * (headings, paragraphs, lists, links) edited as a single document.
 */
export default function LegalPage({ page, title, updated, bodyHtml }) {
  return (
    <PageDoc id={page}>
      <Seo page={page} />
      <Sections>
        <Sec id="body" label="Document" noDuplicate>
          <div className="legal-page">
            <div className="container">
              <T k="title" as="h1">{title}</T>
              <p className="legal-updated"><T k="updatedLabel">Last updated:</T> <T k="updated">{updated}</T></p>
              <R k="body" as="div" mode="block" className="legal-body" html={bodyHtml} />
            </div>
          </div>
        </Sec>
      </Sections>
    </PageDoc>
  );
}
