// Re-export. The body is src/accountMismatch.mjs. The release zip ships that
// file and does not ship dev/. esbuild bundles the src module.

export {
  accountMismatchParagraphs,
  accountMismatchText
} from '../../../../src/accountMismatch.mjs';
