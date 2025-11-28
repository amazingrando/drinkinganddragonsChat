import type { EditorThemeClasses } from "lexical"

export const chatEditorTheme: EditorThemeClasses = {
  // Root
  root: "chat-editor-root",
  
  // Text nodes
  text: {
    base: "chat-editor-text",
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    underlineStrikethrough: "underline line-through",
    code: "bg-muted px-1 py-0.5 rounded font-mono text-sm",
  },
  
  // Paragraph
  paragraph: "m-0 mb-1",
  
  // Quote
  quote: "border-l-4 border-muted-foreground/30 pl-3 my-1 italic text-muted-foreground",
  
  // Heading
  heading: {
    h1: "text-2xl font-bold",
    h2: "text-xl font-bold",
    h3: "text-lg font-bold",
    h4: "text-base font-bold",
    h5: "text-sm font-bold",
    h6: "text-xs font-bold",
  },
  
  // List
  list: {
    nested: {
      listitem: "ml-4",
    },
    ol: "list-decimal ml-4",
    ul: "list-disc ml-4",
    listitem: "my-1",
  },
  
  // Link
  link: "text-primary hover:underline cursor-pointer",
  
  // Code
  code: "bg-muted px-1 py-0.5 rounded font-mono text-sm",
  codeHighlight: {
    atrule: "text-purple-600 dark:text-purple-400",
    attr: "text-blue-600 dark:text-blue-400",
    boolean: "text-red-600 dark:text-red-400",
    builtin: "text-yellow-600 dark:text-yellow-400",
    cdata: "text-gray-600 dark:text-gray-400",
    char: "text-green-600 dark:text-green-400",
    class: "text-blue-600 dark:text-blue-400",
    comment: "text-gray-500 dark:text-gray-500 italic",
    constant: "text-red-600 dark:text-red-400",
    doctype: "text-gray-600 dark:text-gray-400",
    entity: "text-orange-600 dark:text-orange-400",
    function: "text-blue-600 dark:text-blue-400",
    important: "text-red-600 dark:text-red-400",
    inserted: "text-green-600 dark:text-green-400",
    keyword: "text-purple-600 dark:text-purple-400",
    namespace: "text-blue-600 dark:text-blue-400",
    number: "text-red-600 dark:text-red-400",
    operator: "text-gray-600 dark:text-gray-400",
    prolog: "text-gray-600 dark:text-gray-400",
    property: "text-blue-600 dark:text-blue-400",
    punctuation: "text-gray-600 dark:text-gray-400",
    regex: "text-green-600 dark:text-green-400",
    selector: "text-yellow-600 dark:text-yellow-400",
    string: "text-green-600 dark:text-green-400",
    symbol: "text-red-600 dark:text-red-400",
    tag: "text-red-600 dark:text-red-400",
    url: "text-blue-600 dark:text-blue-400",
    variable: "text-orange-600 dark:text-orange-400",
  },
  
  // Table
  table: "border-collapse border border-border",
  tableCell: "border border-border p-2",
  tableCellHeader: "bg-muted font-bold",
  
  // Mention
  mention: "text-mana-200 decoration-mana-300/50 underline font-medium bg-lavender-800/50 px-1 py-0.5 rounded hover:text-mana-100 hover:decoration-mana-100/50 transition-colors duration-150",
  // Self-mention (when user mentions themselves)
  mentionSelf: "text-white font-semibold bg-atomicorange-600/80 px-1 py-0.5 rounded hover:bg-atomicorange-600 animate-pulse transition-colors duration-150",
}

