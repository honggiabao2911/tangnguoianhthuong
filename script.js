const messages = [
  "Nhớ Nhớ Em 💗",
];

let started = false;

function generateRandomNotifications() {
  if (started) return;
  started = true;

  const music = document.getElementById("bgMusic");
  music.volume = 0.65;

  music.play().catch(() => {
    console.log("Không thể phát nhạc. Hãy kiểm tra music.mp3");
  });

  const button = document.getElementById("startBtn");
  button.disabled = true;

  const notificationCount = 100;
  const isMobile = window.innerWidth <= 600;
  const width = isMobile ? 165 : 220;
  const height = isMobile ? 110 : 135;

  for (let i = 0; i < notificationCount; i++) {
    setTimeout(() => {
      const notification = document.createElement("div");
      notification.className = "notification";

      const randomMessage =
        messages[Math.floor(Math.random() * messages.length)];

      notification.innerHTML = `
        <div class="notification-header">
          <span>Tràn Ngập Bộ</span>
          <button class="minimize-btn" aria-label="Đóng">×</button>
        </div>
        <p>${randomMessage}</p>
      `;

      const maxX = Math.max(0, window.innerWidth - width);
      const maxY = Math.max(0, window.innerHeight - height);

      notification.style.left = `${Math.random() * maxX}px`;
      notification.style.top = `${Math.random() * maxY}px`;

      notification.querySelector(".minimize-btn").onclick = () => {
        notification.remove();
      };

      document.body.appendChild(notification);
    }, i * 120);
  }

  createHearts();
}

function createHearts() {
  const container = document.getElementById("hearts");

  setInterval(() => {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.textContent = ["💗", "💕", "💖", "❤️", "🌸"][
      Math.floor(Math.random() * 5)
    ];

    heart.style.left = `${Math.random() * 100}%`;
    heart.style.animationDuration = `${4 + Math.random() * 4}s`;

    container.appendChild(heart);

    setTimeout(() => heart.remove(), 8500);
  }, 350);
}
