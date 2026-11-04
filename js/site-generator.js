/**
 * SiteGenerator: Generates event data, validates schema, converts Markdown, and renders live card previews
 * matching the IndicForum.org templates.
 */

class SiteGenerator {
  /**
   * Escape HTML entities
   */
  static escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Convert markdown text to HTML matching IndicForum's generate_all.py styling
   */
  static markdownToHtml(text) {
    if (!text) return '';
    const lines = text.trim().split('\n');
    const out = [];
    let inP = false;
    let inUl = false;

    for (const rawLine of lines) {
      const l = rawLine.trim();
      if (!l) {
        if (inP) { out.push('</p>'); inP = false; }
        if (inUl) { out.push('</ul>'); inUl = false; }
        continue;
      }

      if (l.startsWith('### ')) {
        if (inP) { out.push('</p>'); inP = false; }
        if (inUl) { out.push('</ul>'); inUl = false; }
        out.push(`<h4 class="font-serif font-bold text-lg text-amber-200 mt-6 mb-3">${this.escapeHtml(l.slice(4))}</h4>`);
        continue;
      } else if (l.startsWith('## ')) {
        if (inP) { out.push('</p>'); inP = false; }
        if (inUl) { out.push('</ul>'); inUl = false; }
        out.push(`<h3 class="font-serif font-bold text-xl text-amber-300 mt-8 mb-4 border-b border-stone-800 pb-2">${this.escapeHtml(l.slice(3))}</h3>`);
        continue;
      } else if (l.startsWith('# ')) {
        if (inP) { out.push('</p>'); inP = false; }
        if (inUl) { out.push('</ul>'); inUl = false; }
        out.push(`<h2 class="font-serif font-bold text-2xl text-amber-100 mt-8 mb-4">${this.escapeHtml(l.slice(2))}</h2>`);
        continue;
      }

      if (l.startsWith('- ') || l.startsWith('* ')) {
        if (inP) { out.push('</p>'); inP = false; }
        if (!inUl) {
          out.push('<ul class="list-disc list-inside space-y-2 text-stone-200 my-4 pl-2">');
          inUl = true;
        }
        let content = this.escapeHtml(l.slice(2));
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-100 font-semibold">$1</strong>');
        content = content.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-amber-400 hover:text-amber-300 underline font-medium">$1</a>');
        out.push(`<li>${content}</li>`);
        continue;
      }

      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }

      let lFmt = this.escapeHtml(l);
      lFmt = lFmt.replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-100 font-semibold">$1</strong>');
      lFmt = lFmt.replace(/\*(.*?)\*/g, '<em class="text-stone-100">$1</em>');
      lFmt = lFmt.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-amber-400 hover:text-amber-300 underline font-medium">$1</a>');

      if (!inP) {
        out.push(`<p class="text-stone-200 leading-relaxed my-3">${lFmt}`);
        inP = true;
      } else {
        out.push(`<br/>${lFmt}`);
      }
    }

    if (inP) out.push('</p>');
    if (inUl) out.push('</ul>');
    return out.join('\n');
  }

  /**
   * Format start_time into readable string
   */
  static formatDateTime(dtStr) {
    if (!dtStr) return 'TBA';
    try {
      const clean = dtStr.split('.')[0].replace(' ', 'T');
      const dt = new Date(clean + (clean.includes('Z') ? '' : 'Z'));
      if (isNaN(dt.getTime())) return dtStr;
      return dt.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch (e) {
      return dtStr;
    }
  }

  /**
   * Merge new event into existing events.json content
   */
  static mergeEventIntoJson(existingJsonStr, newEventData, coverRelativePath = null) {
    let events = [];
    try {
      events = JSON.parse(existingJsonStr || '[]');
      if (!Array.isArray(events)) events = [];
    } catch (e) {
      throw new Error(`Invalid existing events.json: ${e.message}`);
    }

    // Determine ID
    let newId = newEventData.id;
    if (!newId || events.some(e => String(e.id) === String(newId))) {
      const maxId = events.reduce((max, e) => {
        const idNum = parseInt(e.id, 10);
        return !isNaN(idNum) && idNum > max ? idNum : max;
      }, 0);
      newId = maxId > 1000 ? maxId + 50 : (maxId > 0 ? maxId + 1 : 1153);
    }

    const eventRecord = {
      id: parseInt(newId, 10) || newId,
      title: newEventData.title || '',
      primary_speaker: newEventData.primary_speaker || '',
      start_time: newEventData.start_time || '',
      minutes: parseInt(newEventData.minutes, 10) || 60,
      location: newEventData.location || 'Zoom Online Webinar',
      is_published: newEventData.is_published || '0x01',
      is_deleted: newEventData.is_deleted || '0x00',
      is_featured: newEventData.is_featured || '0x01',
      ticket_price: 0,
      youtube_id: newEventData.youtube_id || '',
      should_send_reminders: '0x01',
      subscriber_count: newEventData.subscriber_count || 0,
      status: newEventData.status || 'upcoming',
      cover_image: coverRelativePath || newEventData.cover_image || '',
      amazon_url: newEventData.amazon_url || '',
      registration_url: newEventData.registration_url || '',
      joining_information: newEventData.joining_information || '',
      description: newEventData.description || '',
      moderator: newEventData.moderator || '',
      whatsapp_url: newEventData.whatsapp_url || 'https://rebrand.ly/ifwap',
      contact_email: newEventData.contact_email || 'contact@indiccouncil.org'
    };

    // If updating existing ID, replace; otherwise append
    const existingIndex = events.findIndex(e => String(e.id) === String(eventRecord.id));
    if (existingIndex >= 0) {
      events[existingIndex] = eventRecord;
    } else {
      events.push(eventRecord);
    }

    return {
      updatedEvents: events,
      updatedJson: JSON.stringify(events, null, 2),
      eventRecord
    };
  }

  /**
   * Render HTML preview card for an event
   */
  static renderPreviewCard(event, coverPreviewUrl = null) {
    const coverSrc = coverPreviewUrl || event.cover_image || 'favicon.svg';
    const isUpcoming = event.status === 'upcoming';
    const formattedDate = this.formatDateTime(event.start_time);
    const descHtml = this.markdownToHtml(event.description || '');

    return `
      <div class="indic-card rounded-2xl overflow-hidden border border-stone-800 bg-stone-900 shadow-2xl flex flex-col md:flex-row">
        <div class="md:w-5/12 relative aspect-[16/9] md:aspect-auto overflow-hidden bg-stone-950 flex items-center justify-center">
          <img src="${coverSrc}" alt="${this.escapeHtml(event.title)}" class="w-full h-full object-cover" onerror="this.src='favicon.svg'" />
          <div class="absolute top-3 left-3 flex gap-2">
            <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${isUpcoming ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300'}">
              ${isUpcoming ? 'Upcoming Event' : 'Completed Event'}
            </span>
            ${event.location?.toLowerCase().includes('zoom') ? '<span class="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-900/80 text-blue-200 border border-blue-700/50">Zoom Webinar</span>' : ''}
          </div>
        </div>
        <div class="p-6 md:w-7/12 flex flex-col justify-between space-y-4">
          <div>
            <div class="text-xs uppercase tracking-wider font-semibold text-amber-500 mb-1">
              ${this.escapeHtml(event.primary_speaker)}
            </div>
            <h3 class="text-xl md:text-2xl font-serif font-bold text-stone-100 leading-snug mb-3">
              ${this.escapeHtml(event.title)}
            </h3>
            <div class="flex items-center text-xs text-stone-400 gap-4 mb-4">
              <span class="flex items-center gap-1.5">
                <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                ${formattedDate}
              </span>
              <span class="flex items-center gap-1.5">
                <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                ${event.minutes || 60} mins
              </span>
            </div>
            <div class="text-stone-300 text-sm line-clamp-4 prose prose-invert prose-stone">
              ${descHtml.slice(0, 320)}${descHtml.length > 320 ? '...' : ''}
            </div>
          </div>
          <div class="pt-4 border-t border-stone-800 flex flex-wrap gap-2 text-xs">
            ${event.registration_url ? `<a href="${event.registration_url}" target="_blank" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-lg transition-colors">Register</a>` : ''}
            ${event.youtube_id ? `<a href="${event.youtube_id}" target="_blank" class="px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-600/40 rounded-lg">YouTube Link</a>` : ''}
            ${event.amazon_url ? `<a href="${event.amazon_url}" target="_blank" class="px-3 py-1.5 bg-stone-800 text-stone-300 border border-stone-700 rounded-lg">Buy Book</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

window.SiteGenerator = SiteGenerator;
