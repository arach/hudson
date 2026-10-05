import { redirect } from "next/navigation";
import { DOCS_HOME } from "../../site/seo";

export default function DocsIndex() {
  redirect(DOCS_HOME);
}
