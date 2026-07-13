-- Allow video files in the note-images bucket (it already holds image attachments).
-- Videos are large, so raise the per-file limit and permit common video MIME types
-- alongside the existing image types. allowed_mime_types = null would allow anything;
-- we keep an explicit allowlist so only real media can be uploaded.
update storage.buckets
set
  file_size_limit = 524288000,  -- 500 MB, matches the wrapper's upload ceiling
  allowed_mime_types = array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
    'video/x-matroska', 'video/x-msvideo', 'video/mpeg'
  ]
where id = 'note-images';
