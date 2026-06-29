"use client";

interface Props {
  authorName: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

export function BackCoverPage({ authorName, bio, avatarUrl }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white p-10 select-none">
      <div className="flex flex-col items-center gap-6 max-w-xs text-center">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={authorName}
            className="w-28 h-28 rounded-full object-cover border-4 border-white/20"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center text-5xl">
            👤
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Автор</p>
          <h2 className="text-xl font-semibold">{authorName}</h2>
        </div>
        {bio && (
          <p className="text-sm text-white/70 leading-relaxed line-clamp-6">{bio}</p>
        )}
        <div className="mt-4 pt-4 border-t border-white/10 w-full">
          <p className="text-xs text-white/30">ulit.render.ua</p>
        </div>
      </div>
    </div>
  );
}
