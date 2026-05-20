/// Generates the file browser HTML page served at `/`
/// This allows any browser to access shared files without NexExplorer

pub fn generate_html(
    hostname: &str,
    server_type: &str,
    allow_upload: bool,
    allow_delete: bool,
) -> String {
    let upload_section = if allow_upload {
        r#"
        <div class="upload-section">
            <h3>📤 Upload Files</h3>
            <div id="drop-zone" class="drop-zone">
                <p>Drag & drop files here or click to browse</p>
                <input type="file" id="file-input" multiple style="display:none">
            </div>
            <div id="upload-progress"></div>
        </div>
        "#
    } else {
        ""
    };

    let delete_btn = if allow_delete {
        r#"<button class="btn btn-danger btn-sm delete-btn" data-path="">🗑️</button>"#
    } else {
        ""
    };

    format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{hostname} — NexExplorer</title>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #0d1117; color: #e6edf3; min-height: 100vh; }}
  .header {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
             padding: 20px; border-bottom: 1px solid #30363d; }}
  .header h1 {{ font-size: 1.4em; }}
  .header .meta {{ color: #8b949e; font-size: 0.85em; margin-top: 4px; }}
  .container {{ max-width: 960px; margin: 0 auto; padding: 16px; }}
  .breadcrumb {{ display:flex; gap:4px; flex-wrap:wrap; margin-bottom:16px;
                 align-items:center; font-size:0.9em; }}
  .breadcrumb a {{ color:#58a6ff; text-decoration:none; }}
  .breadcrumb a:hover {{ text-decoration:underline; }}
  .breadcrumb .sep {{ color:#484f58; }}
  .file-list {{ list-style:none; }}
  .file-item {{ display:flex; align-items:center; padding:10px 12px;
                border:1px solid #21262d; border-radius:8px; margin-bottom:6px;
                background:#161b22; transition: background 0.15s; gap:12px; }}
  .file-item:hover {{ background:#1c2129; }}
  .file-icon {{ font-size:1.4em; min-width:32px; text-align:center; }}
  .file-info {{ flex:1; min-width:0; }}
  .file-name {{ font-weight:500; white-space:nowrap; overflow:hidden;
                text-overflow:ellipsis; }}
  .file-name a {{ color:#e6edf3; text-decoration:none; }}
  .file-name a:hover {{ color:#58a6ff; }}
  .file-meta {{ color:#8b949e; font-size:0.8em; margin-top:2px; }}
  .file-actions {{ display:flex; gap:6px; }}
  .btn {{ border:none; border-radius:6px; padding:6px 14px; cursor:pointer;
           font-size:0.85em; transition:all 0.15s; }}
  .btn-primary {{ background:#238636; color:#fff; }}
  .btn-primary:hover {{ background:#2ea043; }}
  .btn-danger {{ background:#da3633; color:#fff; }}
  .btn-danger:hover {{ background:#f85149; }}
  .btn-sm {{ padding:4px 10px; font-size:0.8em; }}
  .upload-section {{ margin-top:20px; padding:16px; background:#161b22;
                     border:1px solid #21262d; border-radius:8px; }}
  .drop-zone {{ border:2px dashed #30363d; border-radius:8px; padding:30px;
                text-align:center; color:#8b949e; cursor:pointer;
                transition: border-color 0.2s; }}
  .drop-zone:hover, .drop-zone.dragover {{ border-color:#58a6ff; color:#58a6ff; }}
  .progress-bar {{ width:100%; height:6px; background:#21262d; border-radius:3px;
                    overflow:hidden; margin-top:8px; }}
  .progress-bar-fill {{ height:100%; background:#238636; transition: width 0.2s; }}
  .stats {{ display:flex; gap:20px; margin-bottom:16px; flex-wrap:wrap; }}
  .stat {{ background:#161b22; border:1px solid #21262d; border-radius:8px;
            padding:12px 16px; }}
  .stat-value {{ font-size:1.4em; font-weight:700; color:#58a6ff; }}
  .stat-label {{ font-size:0.8em; color:#8b949e; }}
  @media(max-width:600px) {{
    .file-item {{ padding:8px; }}
    .stats {{ gap:8px; }}
    .stat {{ padding:8px 12px; flex:1; min-width:100px; }}
  }}
</style>
</head>
<body>
<div class="header">
  <h1>📁 {hostname}</h1>
  <div class="meta">NexExplorer • {server_type} Server</div>
</div>
<div class="container">
  <div class="stats">
    <div class="stat"><div class="stat-value" id="file-count">—</div>
                       <div class="stat-label">Files</div></div>
    <div class="stat"><div class="stat-value" id="total-size">—</div>
                       <div class="stat-label">Total Size</div></div>
  </div>
  <div class="breadcrumb" id="breadcrumb"></div>
  <ul class="file-list" id="file-list">
    <li class="file-item"><div class="file-icon">⏳</div>
                           <div class="file-info">Loading…</div></li>
  </ul>
  {upload_section}
</div>
<script>
const API = window.location.origin;
let currentPath = '';

function icon(file) {{
  if (file.is_dir) return '📁';
  const ext = file.name.split('.').pop().toLowerCase();
  const map = {{
    jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',svg:'🖼️',webp:'🖼️',
    mp4:'🎬',mkv:'🎬',avi:'🎬',mov:'🎬',webm:'🎬',
    mp3:'🎵',wav:'🎵',flac:'🎵',ogg:'🎵',aac:'🎵',
    pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📊',pptx:'📊',
    zip:'📦',rar:'📦','7z':'📦',tar:'📦',gz:'📦',
    js:'🟨',ts:'🔷',py:'🐍',rs:'🦀',html:'🌐',css:'🎨',json:'📋',
    exe:'⚙️',msi:'⚙️',dmg:'⚙️',deb:'⚙️',apk:'📱',
  }};
  return map[ext] || '📄';
}}

function sizeStr(bytes) {{
  if (bytes === 0) return '—';
  const u = ['B','KB','MB','GB','TB'];
  let i = 0;
  while (bytes >= 1024 && i < u.length-1) {{ bytes /= 1024; i++; }}
  return bytes.toFixed(i?1:0) + ' ' + u[i];
}}

async function loadFiles(path) {{
  currentPath = path;
  try {{
    const res = await fetch(API + '/api/files?path=' + encodeURIComponent(path));
    const data = await res.json();
    renderBreadcrumb(path);
    renderFiles(data.files || []);
    document.getElementById('file-count').textContent = data.files?.length || 0;
    let total = 0;
    (data.files||[]).forEach(f => {{ if (!f.is_dir) total += f.size; }});
    document.getElementById('total-size').textContent = sizeStr(total);
  }} catch(e) {{
    document.getElementById('file-list').innerHTML =
      '<li class="file-item"><div class="file-icon">❌</div>'+
      '<div class="file-info">Error loading files: '+e.message+'</div></li>';
  }}
}}

function renderBreadcrumb(path) {{
  const bc = document.getElementById('breadcrumb');
  const parts = path ? path.split('/') : [];
  let html = '<a href="#" onclick="loadFiles(\'\');return false">🏠 Root</a>';
  let accumulated = '';
  parts.forEach((p,i) => {{
    if (!p) return;
    accumulated += '/' + p;
    html += '<span class="sep">/</span>';
    if (i < parts.length - 1) {{
      html += '<a href="#" onclick="loadFiles(\''+accumulated+'\');return false">'+p+'</a>';
    }} else {{
      html += '<span>'+p+'</span>';
    }}
  }});
  bc.innerHTML = html;
}}

function renderFiles(files) {{
  const list = document.getElementById('file-list');
  if (!files.length) {{
    list.innerHTML = '<li class="file-item"><div class="file-icon">📭</div>'+
                     '<div class="file-info">Empty folder</div></li>';
    return;
  }}
  // Sort: directories first, then alphabetical
  files.sort((a,b) => {{
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  }});
  list.innerHTML = files.map(f => {{
    const ic = icon(f);
    const link = f.is_dir
      ? `<a href="#" onclick="loadFiles('${{f.path}}');return false">${{f.name}}</a>`
      : `<a href="${{API}}/api/download/${{encodeURIComponent(f.path).replace(/%2F/g,'/')}}">${{f.name}}</a>`;
    const del = f.is_dir ? '' :
      `{delete_btn}`.replace('data-path=""', 'data-path="'+f.path+'"');
    return `<li class="file-item">
      <div class="file-icon">${{ic}}</div>
      <div class="file-info"><div class="file-name">${{link}}</div>
        <div class="file-meta">${{f.is_dir ? 'Folder' : sizeStr(f.size)}} • ${{f.modified}}</div></div>
      <div class="file-actions">${{del}}</div></li>`;
  }}).join('');
}}

// Upload
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
if (dropZone) {{
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => {{ e.preventDefault(); dropZone.classList.add('dragover'); }});
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {{
    e.preventDefault(); dropZone.classList.remove('dragover');
    uploadFiles(e.dataTransfer.files);
  }});
  fileInput.addEventListener('change', () => uploadFiles(fileInput.files));
}}

async function uploadFiles(fileList) {{
  for (const file of fileList) {{
    const form = new FormData();
    form.append('file', file);
    form.append('path', currentPath);
    try {{
      await fetch(API + '/api/upload', {{ method:'POST', body: form }});
    }} catch(e) {{ console.error('Upload failed:', e); }}
  }}
  loadFiles(currentPath);
}}

// Initial load
loadFiles('');
</script>
</body>
</html>"##,
        hostname = hostname,
        server_type = server_type,
        upload_section = upload_section,
        delete_btn = delete_btn,
    )
}
