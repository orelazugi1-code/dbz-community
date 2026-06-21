let currentUser = null;
let quillEditor = null;
const $ = s => document.querySelector(s);
function timeAgo(d) { const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'עכשיו'; if (s < 3600) return Math.floor(s/60)+' דקות'; if (s < 86400) return Math.floor(s/3600)+' שעות'; return Math.floor(s/86400)+' ימים'; }
function defaultAvatar(n) { return `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=7c5af7&color=fff&size=80`; }
function navigate(h) { window.location.hash = h; }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }


function getBadge(role, badge) {
  if (badge) return ' <span style="background:linear-gradient(135deg,#ffd700,#ff6b35);color:#000;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700">' + badge + '</span>';
  if (role === 'admin') return ' <span style="background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700">מנהל</span>';
  if (role === 'mod') return ' <span style="background:linear-gradient(135deg,#3498db,#2980b9);color:#fff;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700">מודרטור</span>';
  if (role === 'vip') return ' <span style="background:linear-gradient(135deg,#f1c40f,#f39c12);color:#000;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700">VIP</span>';
  return '';
}
function updateNav() {
  const nav = $('#nav');
  nav.innerHTML = currentUser
    ? '<a href="#home">🏠 ראשי</a><a href="#editor">✍️ צור סיפור</a><a href="#settings">⚙️ הגדרות</a><a href="#" onclick="logout();return false">🚪 התנתק</a>'
    : '<a href="#home">🏠 ראשי</a><a href="#login">🔑 התחבר</a>';
}

async function logout() {
  if (!confirm('בטוח שרוצה להתנתק?')) return;
  await API.logout(); currentUser = null; updateNav(); navigate('home');
}

function renderHome() {
  $('#app').innerHTML = `
    <section class="hero">
      <h1>🐉 Dragon Ball Community</h1>
      <p>צור ושתף סיפורי דרגון בול מטורפים עם הקהילה</p>
      <br>${currentUser ? '<a href="#editor" class="btn btn-primary">✍️ צור סיפור חדש</a>' : '<a href="#login" class="btn btn-primary">הצטרף עכשיו!</a>'}
    </section>
    <section class="feed">
      <div class="feed-header">
        <h2>📜 סיפורים</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" onclick="loadPosts(1,'newest')">🆕 חדשים</button>
          <button class="btn btn-secondary" onclick="loadPosts(1,'oldest')">📅 ישנים</button>
          <button class="btn btn-secondary" onclick="loadPosts(1,'popular')">🔥 פופולריים</button>
        </div>
      </div>
      <div class="post-grid" id="postGrid"><div class="loading">טוען...</div></div>
    </section>`;
  loadPosts();
}

async function loadPosts(page = 1, sort = 'newest') {
  try {
    const { posts } = await API.getPosts(page, sort);
    const grid = $('#postGrid');
    if (!posts.length) { grid.innerHTML = '<div class="empty-state"><h3>אין סיפורים עדיין</h3><p>תהיה הראשון ליצור סיפור!</p></div>'; return; }
    grid.innerHTML = posts.map(p => `
      <div class="post-card" onclick="navigate('post/${p.id}')">
        ${p.cover_image ? `<img class="post-card-cover" src="${p.cover_image}">` : '<div class="post-card-cover" style="background:linear-gradient(135deg,#1a1a2e,#7c5af7);display:flex;align-items:center;justify-content:center;font-size:3rem">🐉</div>'}
        <div class="post-card-body">
          <div class="post-card-title">${escapeHtml(p.title)}</div>
          <div class="post-card-meta">
            <div class="post-card-author"><img src="${p.avatar || defaultAvatar(p.display_name)}"><span style="color:${p.display_color}">${escapeHtml(p.display_name)}${getBadge(p.role,p.badge)}</span></div>
            <div class="post-card-stats"><span>❤️ ${p.like_count}</span><span>💬 ${p.comment_count}</span><span>👁️ ${p.views}</span></div>
          </div>
        </div>
      </div>`).join('');
  } catch { $('#postGrid').innerHTML = '<div class="empty-state"><h3>שגיאה בטעינה</h3></div>'; }
}

function renderLogin() {
  $('#app').innerHTML = `
    <div class="auth-container"><div class="auth-box">
      <h2 id="authTitle">🔑 התחברות</h2>
      <form id="authForm">
        <div class="form-group" id="displayNameGroup" style="display:none"><label>שם תצוגה</label><input type="text" id="displayNameInput" placeholder="איך יקראו לך"></div>
        <div class="form-group" id="emailGroup" style="display:none"><label>אימייל (אופציונלי — לשחזור חשבון)</label><input type="email" id="emailInput" placeholder="לא חובה"></div>
        <div class="form-group"><label>שם משתמש</label><input type="text" id="usernameInput" placeholder="שם משתמש" required></div>
        <div class="form-group"><label>סיסמה</label><input type="password" id="passwordInput" placeholder="סיסמה" required></div>
        <div id="authError" style="color:#e74c3c;margin-bottom:10px;font-size:0.9rem"></div>
        <button type="submit" class="btn btn-primary" style="width:100%" id="authSubmit">התחבר</button>
      </form>
      <div class="auth-toggle"><span id="authToggleText">אין לך חשבון?</span> <a href="#" onclick="toggleAuth();return false" id="authToggleLink">הירשם</a></div>
    </div></div>`;
  let isLogin = true;
  window.toggleAuth = () => {
    isLogin = !isLogin;
    $('#authTitle').textContent = isLogin ? '🔑 התחברות' : '📝 הרשמה';
    $('#authSubmit').textContent = isLogin ? 'התחבר' : 'הירשם';
    $('#authToggleText').textContent = isLogin ? 'אין לך חשבון?' : 'יש לך חשבון?';
    $('#authToggleLink').textContent = isLogin ? 'הירשם' : 'התחבר';
    $('#displayNameGroup').style.display = isLogin ? 'none' : 'block';
    $('#emailGroup').style.display = isLogin ? 'none' : 'block';
  };
  $('#authForm').onsubmit = async e => {
    e.preventDefault(); $('#authError').textContent = '';
    try {
      if (isLogin) await API.login({ username: $('#usernameInput').value, password: $('#passwordInput').value });
      else await API.register({ username: $('#usernameInput').value, password: $('#passwordInput').value, email: $('#emailInput').value, displayName: $('#displayNameInput').value });
      const { user } = await API.me(); currentUser = user; updateNav(); navigate('home');
    } catch (err) { $('#authError').textContent = err.message; }
  };
}

function renderEditor() {
  if (!currentUser) return navigate('login');
  quillEditor = null;
  $('#app').innerHTML = `
    <div class="editor-container">
      <h2>✍️ צור סיפור חדש</h2>
      <div class="form-group"><label>כותרת הסיפור</label><input type="text" id="postTitle" placeholder="שם הסיפור..." maxlength="100"></div>
      <div class="form-group"><label>תמונת שער (אופציונלי)</label>
        <div style="display:flex;gap:10px"><input type="text" id="coverUrl" placeholder="קישור לתמונה או העלה קובץ"><input type="file" id="coverFile" accept="image/*" style="display:none"><button class="btn btn-secondary" onclick="$('#coverFile').click()">📁 העלה</button></div>
        <div id="coverPreview" style="margin-top:10px"></div>
      </div>
      <div id="quillEditor" style="min-height:400px;background:var(--bg2);color:#e0e0e0;border:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);font-size:1.05rem;direction:rtl"></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="insertAiImageToEditor()">🖼️ העלה תמונה</button>
        <button class="btn btn-secondary" onclick="insertBubbleToEditor()">💬 בועת טקסט</button>
        <button class="btn btn-secondary" onclick="insertHrToEditor()">━━ קו מפריד</button>
      </div>
      
      <div class="editor-footer">
        <button class="btn btn-primary" onclick="publishPost()" style="padding:12px 32px;font-size:1rem">🚀 פרסם סיפור</button>
        <span id="editorStatus" style="color:var(--text2);font-size:0.9rem"></span>
      </div>
      <div id="aiFab" onclick="toggleAiPanel()" style="position:fixed;bottom:30px;left:30px;width:60px;height:60px;background:linear-gradient(135deg,#ffd700,#ff6b35);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;box-shadow:0 0 20px rgba(255,215,0,0.4);z-index:200;border:none">🤖</div><div id="aiPanel" style="display:none;position:fixed;bottom:100px;left:30px;width:380px;background:#12121a;border:2px solid #ffd700;border-radius:16px;padding:20px;z-index:200;box-shadow:0 0 40px rgba(0,0,0,0.5);max-height:70vh;overflow-y:auto"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="color:#ffd700;margin:0">🤖 AI מחולל</h3><button onclick="toggleAiPanel()" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer">✕</button></div><div style="margin-bottom:14px"><h4 style="color:#fff;margin-bottom:8px">📖 יצירת סיפור</h4><textarea id="storyPrompt" rows="3" placeholder="תאר סיפור..." style="width:100%;background:#1a1a2e;color:#e0e0e0;border:1px solid rgba(255,215,0,0.15);border-radius:8px;padding:10px;font-family:inherit;resize:vertical"></textarea><button class="btn btn-primary" onclick="generateStory()" id="storyBtn" style="margin-top:6px;width:100%">📖 צור סיפור</button><span id="storyStatus" style="display:block;margin-top:4px;color:#888;font-size:0.8rem"></span></div><hr style="border-color:rgba(255,215,0,0.15)"><div style="margin-top:14px"><h4 style="color:#fff;margin-bottom:8px">🎨 יצירת תמונה</h4><input type="text" id="aiPrompt" placeholder="עברית או אנגלית" style="width:100%;background:#1a1a2e;color:#e0e0e0;border:1px solid rgba(255,215,0,0.15);border-radius:8px;padding:10px;margin-bottom:6px"><select id="aiStyle" style="width:100%;background:#1a1a2e;color:#e0e0e0;border:1px solid rgba(255,215,0,0.15);border-radius:8px;padding:8px;margin-bottom:6px"><option value="">ללא</option><option value="dragon ball anime">Dragon Ball</option><option value="epic anime cinematic">אנימה</option><option value="dark cosmic">אלוהי</option><option value="neon cyberpunk">ניאון</option></select><button class="btn btn-primary" onclick="generateAiImage()" style="width:100%">🎨 צור</button><div id="aiPreview" style="margin-top:8px"></div></div></div><input type="file" id="imageFileInput" accept="image/*" style="display:none">
    </div>`;

  quillEditor = new Quill('#quillEditor', {
    theme: 'snow',
    placeholder: 'התחל לכתוב את הסיפור שלך...',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': ['#ffd700','#ff2d95','#7c5af7','#06b6d4','#2ecc71','#e74c3c','#ff6b35','#a5f3fc','#00ff88','#ffffff','#888888'] }, { 'background': ['#1a1a2e','#2d1b69','#691b3d','#1b4d2e','#4d3b1b','transparent'] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        [{ 'align': ['', 'center', 'right'] }],
        ['blockquote'],
        ['link', 'image'],
        ['clean']
      ]
    }
  });

  $('#coverFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const { url } = await API.uploadImage(f); $('#coverUrl').value = url; $('#coverPreview').innerHTML = '<img src="' + url + '" style="max-width:300px;border-radius:8px">'; } catch (err) { alert(err.message); } };
  $('#imageFileInput').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const { url } = await API.uploadImage(f); const range = quillEditor.getSelection(true); quillEditor.insertEmbed(range.index, 'image', url); } catch (err) { alert(err.message); } };
}

function insertAiImageToEditor() { $('#imageFileInput').click(); }
function insertBubbleToEditor() {
  if (!quillEditor) return;
  const range = quillEditor.getSelection(true);
  quillEditor.insertText(range.index, '\n');
  quillEditor.formatLine(range.index + 1, 1, 'blockquote', true);
  quillEditor.insertText(range.index + 1, 'כתוב כאן...');
  quillEditor.setSelection(range.index + 1, 11);
}
function insertHrToEditor() {
  if (!quillEditor) return;
  const range = quillEditor.getSelection(true);
  quillEditor.insertText(range.index, '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function addImageToEditor(url) {
  if (!quillEditor) return;
  const range = quillEditor.getSelection(true);
  quillEditor.insertEmbed(range.index, 'image', url);
  quillEditor.insertText(range.index + 1, '\n');
}

async function generateAiImage() {
  const rawPrompt = $('#aiPrompt').value.trim();
  if (!rawPrompt) return;
  const style = $('#aiStyle').value;
  $('#aiPreview').innerHTML = '<p style="color:var(--text2)">🎨 מתרגם ומייצר תמונה...</p>';
  let prompt = rawPrompt;
  if (/[֐-׿]/.test(rawPrompt)) {
    try { const tr = await API.request('POST', '/api/translate-prompt', { text: rawPrompt }); prompt = tr.prompt; } catch {}
  }
  const full = (prompt + ' ' + style + ' epic no text').trim();
  const seed = Math.floor(Math.random() * 999999);
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(full) + '?width=800&height=400&nologo=true&seed=' + seed;
  const img = new Image();
  img.onload = () => {
    $('#aiPreview').innerHTML = '<img src="' + url + '" style="max-width:100%;border-radius:12px;border:2px solid var(--border)"><br><br>' +
      '<button class="btn btn-secondary" onclick="addImageToEditor(\'' + url + '\')">📥 הוסף לסיפור</button> ' +
      '<button class="btn btn-secondary" onclick="document.getElementById(\'coverUrl\').value=\'' + url + '\'">🖼️ תמונת שער</button>';
  };
  img.onerror = () => { $('#aiPreview').innerHTML = '<p style="color:#e74c3c">❌ שגיאה, נסה שוב</p>'; };
  img.src = url;
}

async function publishPost() {
  const title = $('#postTitle').value.trim();
  if (!quillEditor) return;
  const content = quillEditor.root.innerHTML.trim();
  const coverImage = $('#coverUrl').value.trim();
  if (!title) return alert('צריך כותרת!');
  if (!content || content === '<p><br></p>') return alert('צריך תוכן!');
  $('#editorStatus').textContent = 'מפרסם...';
  try { const { id } = await API.createPost({ title, content, coverImage }); navigate('post/' + id); } catch (err) { $('#editorStatus').textContent = err.message; }
}

async function renderPost(id) {
  $('#app').innerHTML = '<div class="loading">טוען...</div>';
  try {
    const { post, comments } = await API.getPost(id);
    const isOwner = currentUser && currentUser.id === post.user_id;
    $('#app').innerHTML = `
      <div class="post-view">
        ${post.cover_image ? `<img class="post-view-cover" src="${post.cover_image}">` : ''}
        <div class="post-view-header">
          <h1 class="post-view-title">${escapeHtml(post.title)}</h1>
          <div class="post-view-meta"><img src="${post.avatar || defaultAvatar(post.display_name)}"><span style="color:${post.display_color};font-weight:600">${escapeHtml(post.display_name)}${getBadge(post.role,post.badge)}</span><span>· לפני ${timeAgo(post.created_at)}</span><span>· 👁️ ${post.views}</span></div>
        </div>
        <div class="post-view-content">${post.content}</div>
        <div class="post-actions">
          <button class="like-btn" id="likeBtn" onclick="toggleLike(${post.id})">❤️ <span id="likeCount">${post.like_count}</span></button>
          ${isOwner ? `<button class="btn btn-danger" onclick="deletePost(${post.id})">🗑️ מחק</button>` : ''}
          <a href="#home" class="btn btn-secondary">← חזרה</a>
        </div>
        <div class="comments-section">
          <h3>💬 תגובות (${comments.length})</h3>
          ${currentUser ? `<div class="comment-box"><input type="text" id="commentInput" placeholder="כתוב תגובה..." onkeydown="if(event.key==='Enter')addComment(${post.id})"><button class="btn btn-primary" onclick="addComment(${post.id})">שלח</button></div>` : '<p style="color:var(--text2);margin:10px 0"><a href="#login">התחבר</a> כדי להגיב</p>'}
          <div id="commentsList" style="margin-top:16px">${comments.map(c => `
            <div class="comment"><div class="comment-header"><img src="${c.avatar || defaultAvatar(c.display_name)}"><span class="name" style="color:${c.display_color}">${escapeHtml(c.display_name)}${getBadge(c.role,c.badge)}</span><span class="time">· לפני ${timeAgo(c.created_at)}</span></div><div>${escapeHtml(c.content)}</div></div>`).join('')}</div>
        </div>
      </div>`;
  } catch { $('#app').innerHTML = '<div class="empty-state"><h3>פוסט לא נמצא</h3><a href="#home">חזרה</a></div>'; }
}

async function toggleLike(id) { if (!currentUser) return navigate('login'); try { const { liked, count } = await API.likePost(id); $('#likeCount').textContent = count; $('#likeBtn').classList.toggle('liked', liked); } catch {} }
async function addComment(id) { const i = $('#commentInput'); const c = i.value.trim(); if (!c) return; try { await API.comment(id, c); renderPost(id); } catch (err) { alert(err.message); } }
async function deletePost(id) { if (!confirm('בטוח שרוצה למחוק?')) return; await API.deletePost(id); navigate('home'); }

function renderSettings() {
  if (!currentUser) return navigate('login');
  $('#app').innerHTML = `
    <div class="settings-container">
      <h2 style="font-size:1.5rem;background:linear-gradient(135deg,var(--gold),var(--orange));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px">⚙️ הגדרות</h2>
      <div class="settings-box"><h3>👤 פרופיל</h3>
        <div class="avatar-upload"><img src="${currentUser.avatar || defaultAvatar(currentUser.display_name)}" id="settingsAvatar"><div><input type="file" id="avatarFile" accept="image/*" style="display:none"><button class="btn btn-secondary" onclick="$('#avatarFile').click()">📷 שנה תמונה</button></div></div>
        <div class="form-group"><label>שם תצוגה</label><input type="text" id="setDisplayName" value="${escapeHtml(currentUser.display_name)}"></div>
        <div class="form-group"><label>צבע שם</label><input type="color" id="setColor" value="${currentUser.display_color}" style="width:60px;height:36px;padding:2px"></div>
        <div class="form-group"><label>ביוגרפיה</label><textarea id="setBio" rows="3" placeholder="ספר על עצמך...">${escapeHtml(currentUser.bio || '')}</textarea></div>
        <button class="btn btn-primary" onclick="saveSettings()">💾 שמור</button><span id="settingsStatus" style="margin-right:10px;color:var(--text2);font-size:0.9rem"></span>
      </div>
      <div class="settings-box"><h3>🔑 טוקן API</h3>
        <p style="color:var(--text2);font-size:0.9rem;margin-bottom:10px">הטוקן שלך לגישה חיצונית. אל תשתף אותו!</p>
        <div class="token-box"><span id="tokenDisplay">${currentUser.token ? currentUser.token.substring(0, 10) + '...' : 'אין'}</span><div style="display:flex;gap:6px"><button class="btn btn-secondary" onclick="showToken()" style="font-size:0.8rem">👁️ הצג</button><button class="btn btn-secondary" onclick="regenToken()" style="font-size:0.8rem">🔄 חדש</button></div></div>
      </div>
    </div>`;
  $('#avatarFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const form = new FormData(); form.append('avatar', f); const res = await fetch('/api/settings/avatar', { method: 'POST', body: form }); const data = await res.json(); if (data.avatar) { $('#settingsAvatar').src = data.avatar; currentUser.avatar = data.avatar; } } catch {} };
}

async function saveSettings() { try { await API.updateSettings({ displayName: $('#setDisplayName').value, displayColor: $('#setColor').value, bio: $('#setBio').value }); const { user } = await API.me(); currentUser = user; updateNav(); $('#settingsStatus').textContent = '✅ נשמר!'; setTimeout(() => $('#settingsStatus').textContent = '', 2000); } catch (err) { $('#settingsStatus').textContent = '❌ ' + err.message; } }
function showToken() { $('#tokenDisplay').textContent = currentUser.token; }
async function regenToken() { if (!confirm('בטוח? הטוקן הישן יפסיק לעבוד')) return; const { token } = await API.regenToken(); currentUser.token = token; $('#tokenDisplay').textContent = token; }

function toggleAiPanel(){var p=document.querySelector("#aiPanel");p.style.display=p.style.display==="none"?"block":"none";}

async function generateStory(){
  var d=document.querySelector("#storyPrompt").value.trim();
  if(!d)return alert("תכתוב תיאור!");
  document.querySelector("#storyBtn").disabled=true;
  document.querySelector("#storyStatus").textContent="🔄 יוצר סיפור עם תמונות...";
  try{
    var r=await API.request("POST","/api/generate-story",{description:d});
    if(quillEditor&&r.story){
      var story=r.story;
      var chapters=story.match(/<h2[^>]*>([^<]+)<\/h2>/g)||[];
      for(var i=0;i<chapters.length;i++){
        var title=chapters[i].replace(/<[^>]*>/g,"").trim();
        var prompt=d+" "+title+" dragon ball anime epic cinematic";
        var finalPrompt=prompt;
        if(/[֐-׿]/.test(prompt)){
          try{var tr=await API.request("POST","/api/translate-prompt",{text:prompt});finalPrompt=tr.prompt;}catch{}
        }
        var seed=Math.floor(Math.random()*999999);
        var imgUrl="https://image.pollinations.ai/prompt/"+encodeURIComponent(finalPrompt+" epic anime no text")+"?width=800&height=400&nologo=true&seed="+seed;
        story=story.replace("CHAPTER_IMAGE",imgUrl);
      }
      story=story.replace(/CHAPTER_IMAGE/g,"https://image.pollinations.ai/prompt/"+encodeURIComponent(d+" dragon ball anime epic")+"?width=800&height=400&nologo=true&seed="+Math.floor(Math.random()*999999));
      var delta=quillEditor.clipboard.convert(story);
      quillEditor.setContents(delta);
      document.querySelector("#storyStatus").textContent="✅ סיפור + תמונות!";
    }
  }catch(e){document.querySelector("#storyStatus").textContent="❌ "+e.message;}
  document.querySelector("#storyBtn").disabled=false;
}

async function router() {
  const hash = window.location.hash.slice(1) || 'home';
  const [page, param] = hash.split('/');
  if (page === 'home') renderHome();
  else if (page === 'login') renderLogin();
  else if (page === 'editor') renderEditor();
  else if (page === 'post' && param) renderPost(param);
  else if (page === 'settings') renderSettings();
  else renderHome();
}

(async () => {
  try { const { user } = await API.me(); currentUser = user; } catch {}
  updateNav(); router();
  window.addEventListener('hashchange', router);
})();
