interface ModeratedBook {
  moderationStatus?: string | null;
  moderationNote?: string | null;
}

export interface RejectedConcerns {
  cover: boolean;
  manuscript: boolean;
  metadata: boolean;
}

export function parseRejectedConcerns(book: ModeratedBook): RejectedConcerns {
  if (book.moderationStatus !== "REJECTED" || !book.moderationNote) {
    return { cover: false, manuscript: false, metadata: false };
  }
  const n = book.moderationNote.toLowerCase();
  return {
    cover: /обкладин/.test(n),
    manuscript: /рукопис|docx|файл|конверт/.test(n),
    metadata: /назв|опис|жанр|мов|ціна|price|isbn|метадан/.test(n),
  };
}
