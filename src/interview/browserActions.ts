/** Shared local notification and exact-plan approval interactions. No raw HTML insertion. */
export const interviewBrowserScript = String.raw`
(() => {
  let token = '', busy = false, selectedSignature = null, noticeSignature = null, refreshing = false;
  const notices = document.getElementById('interview-notifications');
  const button = document.querySelector('[data-plan-decision]');
  const message = document.getElementById('plan-action-status');
  function text(parent, tag, value) { const element = document.createElement(tag); element.textContent = value; parent.append(element); return element; }
  async function post(path, body) {
    const response = await fetch(path, {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Interview-CSRF':token},body:JSON.stringify(body)});
    if (!response.ok) throw new Error(response.status === 409 ? 'The plan changed. Refresh this page and review the current version.' : 'Could not save this action. Please try again.');
    return response.json();
  }
  async function refresh() {
    if (refreshing) return; refreshing = true;
    try {
      const response = await fetch('/api/interviews/state', {credentials:'same-origin'});
      if (!response.ok) return;
      const state = await response.json(); token = state.csrf;
      const nextNotices = JSON.stringify(state.notifications);
      if (notices && noticeSignature !== nextNotices) {
        noticeSignature = nextNotices;
        notices.replaceChildren(); notices.hidden = !state.notifications.length;
        for (const notice of state.notifications) {
          const row = text(notices, 'div', ''); row.className = 'interview-notice';
          text(row, 'strong', notice.company + ' · ' + notice.role);
          text(row, 'p', 'Your scheduled interview has ended. How did it go? Share the questions, your answers and feedback using the debrief request form on Interview preparation.');
          const link = text(row, 'a', 'Review this interview ↗'); link.href = notice.href;
          const dismiss = text(row, 'button', 'Dismiss'); dismiss.type = 'button';
          dismiss.addEventListener('click', async () => { dismiss.disabled = true; try { await post('/api/interviews/dismiss', {notificationId:notice.id}); await refresh(); } catch { dismiss.disabled = false; } });
        }
      }
      // Practice has no approval button; watch its own server-rendered state.
      const practice = document.querySelector('[data-practice-round]');
      if (practice) {
        const round = state.rounds.find(round => round.id === practice.dataset.practiceRound);
        if (round) {
          const signature = JSON.stringify([round.revision, round.proposalId ?? null, round.current, round.materialReady, round.generation?.status ?? null]);
          if (signature !== practice.dataset.practiceState) {
            const page = await fetch(location.href, {credentials:'same-origin',cache:'no-store'});
            if (page.ok) {
              const next = new DOMParser().parseFromString(await page.text(), 'text/html').querySelector('[data-practice-round]');
              if (next && next.dataset.practiceRound === practice.dataset.practiceRound) {
                practice.replaceChildren(...Array.from(next.childNodes));
                practice.dataset.practiceState = next.dataset.practiceState;
              }
            }
          }
        }
      }
      if (button) {
        const command = JSON.parse(button.dataset.planDecision);
        const round = state.rounds.find(round => round.id === command.interviewId);
        if (!round || round.revision !== command.expectedRevision || round.proposalId !== command.proposalId || !round.current || round.cancelled) {
          button.disabled = true; if (message) message.textContent = 'This plan changed. Refresh and review the current version.'; return;
        }
        const signature = JSON.stringify([round.proposalStatus, round.generation]);
        if (selectedSignature !== null && signature !== selectedSignature && (busy || button.dataset.waiting === 'true')) { location.reload(); return; }
        selectedSignature = signature;
        if (!busy) button.disabled = ['queued','running'].includes(round.generation?.status) || round.materialReady;
      }
    } catch { /* Keep existing notices and approval unavailable until connected. */ }
    finally { refreshing = false; }
  }
  if (button) {
    button.disabled = true;
    button.addEventListener('click', async () => {
      if (busy || !token) return; busy = true; button.disabled = true;
      if (message) message.textContent = 'Saving your plan decision…';
      try {
        await post('/api/interviews/approve-plan', JSON.parse(button.dataset.planDecision));
        location.reload();
      } catch (error) { if (message) message.textContent = error.message; busy = false; button.disabled = false; }
    });
  }
  refresh(); setInterval(refresh, 3000);
})();`;
