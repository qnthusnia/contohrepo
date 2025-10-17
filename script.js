const API_URL = "https://n8n.starcore.co.id/webhook/chatbot";
//https://n8n.starcore.co.id/webhook/chatbot
//https://n8n.starcore.co.id/webhook-test/chatbot
//https://n8n.starcore.co.id/webhook-test/test_ocr
//https://n8n.starcore.co.id/webhook/test_ocr

const messagesContainer = document.getElementById("messages");
const inputField = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");

// Tambah pesan ke chatbox
function addMessage(text, sender, isHTML = false) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message-wrapper", sender);

  const bubble = document.createElement("div");
  bubble.classList.add("message");

  if (isHTML || sender === "bot") {
    const formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    bubble.innerHTML = formatted;
  } else {
    bubble.textContent = text;
  }

  const time = document.createElement("div");
  time.classList.add("timestamp");
  time.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  wrapper.appendChild(bubble);
  wrapper.appendChild(time);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Typing indicator
function showTyping() {
  const typing = document.createElement("div");
  typing.id = "typing";
  typing.classList.add("message-wrapper", "bot");
  typing.innerHTML = `<div class="message typing">
    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
  </div>`;
  messagesContainer.appendChild(typing);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  document.querySelector(".chat-title")?.classList.add("processing");
}

function hideTyping() {
  const typing = document.getElementById("typing");
  if (typing) typing.remove();

  document.querySelector(".chat-title")?.classList.remove("processing");
}

// Kirim pesan ke server
async function sendMessage() {
  const text = inputField.value.trim();
  const files = Array.from(fileInput.files);

  if (!text && files.length === 0) return;

  // === gabungkan text + preview file ke bubble user ===
  let userHTML = "";
  if (text) userHTML += `<p>${text}</p>`;
  files.forEach((file) => {
    if (file.type.startsWith("image/")) {
      const imgURL = URL.createObjectURL(file);
      userHTML += `<div><img src="${imgURL}" alt="${file.name}" style="max-width:120px;max-height:120px;border-radius:6px;display:block;margin-top:5px;"/></div>`;
    } else {
      userHTML += `<div style="margin-top:5px;">📎 ${file.name}</div>`;
    }
  });
  addMessage(userHTML, "user", true);

  // reset input
  inputField.value = "";
  fileInput.value = "";
  filePreview.innerHTML = "";

  showTyping();

  try {
    const formData = new FormData();
    formData.append("message", text || "");
    files.forEach((file) => {
      formData.append("data", file);
    });

    const res = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    hideTyping();

    // ==== MULTI CONDITION HANDLING ====

    // 1. Chart + ringkasan + rekomendasi
    if (data.url && (!data.type || data.type === "image")) {
      let combinedHTML = `<img src="${data.url}" alt="chart" style="max-width:100%;border-radius:6px;"/>`;

      if (data.ringkasan_chart) {
        combinedHTML += `<p>${data.ringkasan_chart}</p>`;
      }
      if (data.rekomendasi && Array.isArray(data.rekomendasi)) {
        combinedHTML += `<p><strong>Rekomendasi:</strong></p><ul>`;
        combinedHTML += data.rekomendasi.map(r => `<li>${r}</li>`).join("");
        combinedHTML += `</ul>`;
      }

      addMessage(combinedHTML, "bot", true);
    }

    // 2. Hanya ringkasan + rekomendasi
    else if (data.ringkasan_chart || (data.rekomendasi && Array.isArray(data.rekomendasi))) {
      let combinedHTML = "";

      if (data.ringkasan_chart) {
        combinedHTML += `<p>${data.ringkasan_chart}</p>`;
      }
      if (data.rekomendasi && Array.isArray(data.rekomendasi)) {
        combinedHTML += `<p><strong>Rekomendasi:</strong></p><ul>`;
        combinedHTML += data.rekomendasi.map(r => `<li>${r}</li>`).join("");
        combinedHTML += `</ul>`;
      }

      addMessage(combinedHTML, "bot", true);
    }

    // 3. File tunggal
    else if (data.type === "file") {
      const fileHTML = `
        📎 <strong>${data.title || "Dokumen"}</strong><br/>
        <a href="${data.url}" target="_blank" download>Download File</a>
      `;
      addMessage(fileHTML, "bot", true);
    }

    // 4. Multiple files
    else if (data.files && Array.isArray(data.files)) {
      let combinedFilesHTML = "<p><strong>📎 File dari bot:</strong></p>";
      data.files.forEach(f => {
        combinedFilesHTML += `
          <div style="margin-top:5px;">
            <strong>${f.title || "Dokumen"}</strong><br/>
            <a href="${f.url}" target="_blank" download>Download</a>
          </div>
        `;
      });
      addMessage(combinedFilesHTML, "bot", true);
    }

    // 5. Array of responses
    else if (Array.isArray(data.responses)) {
      data.responses.forEach(resp => {
        let html = "";
        if (resp.url) {
          html += `<img src="${resp.url}" style="max-width:100%;border-radius:6px;"/><br/>`;
        }
        if (resp.text) {
          html += `<p>${resp.text}</p>`;
        }
        if (resp.rekomendasi) {
          html += `<p><strong>Rekomendasi:</strong></p><ul>`;
          html += resp.rekomendasi.map(r => `<li>${r}</li>`).join("");
          html += `</ul>`;
        }
        addMessage(html, "bot", true);
      });
    }

    // 6. 🔥 Fallback universal → selalu tampilkan kalau ada reply/output
    else if (data.reply || data.output) {
      addMessage(data.reply || data.output, "bot", true);
    }

    // 7. Jika tidak ada apa-apa
    else {
      addMessage("❌ Tidak ada respon dari server.", "bot");
    }

  } catch (err) {
    hideTyping();
    addMessage("❌ Maaf server sedang sibuk", "bot");
  }
}

// Event listener
sendBtn.addEventListener("click", sendMessage);
inputField.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

inputField.addEventListener("input", () => {
  inputField.style.height = "auto";
  inputField.style.height = inputField.scrollHeight + "px";
});

fileInput.addEventListener("change", () => {
  filePreview.innerHTML = ""; 
  const files = Array.from(fileInput.files);

  files.forEach((file, index) => {
    const wrapper = document.createElement("div");
    wrapper.classList.add("file-item");

    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.style.width = "50px";
      img.style.height = "50px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "6px";
      wrapper.appendChild(img);
    } else {
      const div = document.createElement("div");
      div.textContent = `📎 ${file.name}`;
      div.style.fontSize = "12px";
      div.style.background = "#f0f0f0";
      div.style.padding = "4px 6px";
      div.style.borderRadius = "4px";
      wrapper.appendChild(div);
    }

    const removeBtn = document.createElement("span");
    removeBtn.textContent = "✖";
    removeBtn.style.marginLeft = "6px";
    removeBtn.style.cursor = "pointer";
    removeBtn.style.color = "red";
    removeBtn.onclick = () => {
      const dt = new DataTransfer();
      Array.from(fileInput.files).forEach((f, i) => {
        if (i !== index) dt.items.add(f);
      });
      fileInput.files = dt.files;
      wrapper.remove();
    };

    wrapper.appendChild(removeBtn);
    filePreview.appendChild(wrapper);
  });
});


