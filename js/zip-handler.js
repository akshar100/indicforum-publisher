/**
 * ZipHandler: Handles unpacking, validating, and generating Event Zip packages using JSZip.
 */

class ZipHandler {
  /**
   * Parse an uploaded Zip file and extract event metadata and assets
   * @param {File|Blob} zipFile 
   * @returns {Promise<Object>} parsed event data, images, and raw assets
   */
  static async parseEventZip(zipFile) {
    if (!window.JSZip) {
      throw new Error('JSZip library is not loaded.');
    }

    const zip = await window.JSZip.loadAsync(zipFile);
    const files = Object.keys(zip.files).filter(name => !zip.files[name].dir && !name.startsWith('__MACOSX/'));

    if (files.length === 0) {
      throw new Error('The uploaded zip archive is empty.');
    }

    // Locate event.json (allow root or nested 1 level)
    const jsonPath = files.find(f => f.toLowerCase().endsWith('event.json') || f.toLowerCase().endsWith('metadata.json'));
    if (!jsonPath) {
      throw new Error('Missing event.json in zip package. Please include an event.json file.');
    }

    const jsonStr = await zip.files[jsonPath].async('string');
    let metadata;
    try {
      metadata = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`Failed to parse event.json: ${e.message}`);
    }

    // Look for description.md if description not in event.json
    const mdPath = files.find(f => f.toLowerCase().endsWith('description.md') || f.toLowerCase().endsWith('details.md'));
    let descriptionText = metadata.description || '';
    if (mdPath) {
      const mdStr = await zip.files[mdPath].async('string');
      if (mdStr.trim()) {
        descriptionText = mdStr.trim();
      }
    }

    // Look for cover image
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
    let coverFile = null;
    let coverFilename = '';

    // First check if filename indicated in metadata.cover_image matches a file in zip
    if (metadata.cover_image && !metadata.cover_image.startsWith('http')) {
      const targetName = metadata.cover_image.split('/').pop().toLowerCase();
      const match = files.find(f => f.split('/').pop().toLowerCase() === targetName);
      if (match) {
        coverFile = zip.files[match];
        coverFilename = match.split('/').pop();
      }
    }

    // If not found, look for cover.* or any image file
    if (!coverFile) {
      const coverMatch = files.find(f => {
        const lower = f.toLowerCase();
        return lower.includes('cover.') || lower.includes('banner.') || lower.includes('poster.');
      }) || files.find(f => imageExtensions.some(ext => f.toLowerCase().endsWith(ext)));

      if (coverMatch) {
        coverFile = zip.files[coverMatch];
        coverFilename = coverMatch.split('/').pop();
      }
    }

    let coverBase64 = null;
    let coverDataUrl = null;
    let coverMimeType = 'image/jpeg';

    if (coverFile) {
      coverBase64 = await coverFile.async('base64');
      const ext = coverFilename.split('.').pop().toLowerCase();
      if (ext === 'png') coverMimeType = 'image/png';
      else if (ext === 'webp') coverMimeType = 'image/webp';
      else if (ext === 'svg') coverMimeType = 'image/svg+xml';
      else coverMimeType = 'image/jpeg';

      coverDataUrl = `data:${coverMimeType};base64,${coverBase64}`;
    }

    // Validation
    const errors = [];
    if (!metadata.title?.trim()) errors.push('Field "title" is required.');
    if (!metadata.primary_speaker?.trim()) errors.push('Field "primary_speaker" is required.');

    // Format start_time
    let formattedStartTime = metadata.start_time;
    if (formattedStartTime) {
      // Normalise to "YYYY-MM-DD HH:MM:SS.000000"
      try {
        const dt = new Date(formattedStartTime);
        if (!isNaN(dt.getTime())) {
          const iso = dt.toISOString(); // e.g. 2026-10-17T16:00:00.000Z
          formattedStartTime = iso.replace('T', ' ').replace('Z', '') + (iso.includes('.') ? '000' : '.000000');
        }
      } catch (e) {
        // keep as is
      }
    } else {
      errors.push('Field "start_time" is required (e.g., "2026-10-17 16:00:00.000000").');
    }

    return {
      isValid: errors.length === 0,
      errors,
      rawFiles: files,
      event: {
        id: metadata.id || null, // Will be computed if null
        title: metadata.title || '',
        primary_speaker: metadata.primary_speaker || '',
        start_time: formattedStartTime || '',
        minutes: parseInt(metadata.minutes, 10) || 60,
        location: metadata.location || 'Zoom Online Webinar',
        status: metadata.status || 'upcoming',
        cover_image: metadata.cover_image || (coverFilename ? `assets/images/${coverFilename}` : ''),
        youtube_id: metadata.youtube_id || '',
        amazon_url: metadata.amazon_url || '',
        registration_url: metadata.registration_url || '',
        joining_information: metadata.joining_information || 'Registration details will be sent via email prior to the talk.',
        description: descriptionText,
        moderator: metadata.moderator || '',
        whatsapp_url: metadata.whatsapp_url || 'https://rebrand.ly/ifwap',
        contact_email: metadata.contact_email || 'contact@indiccouncil.org',
        ticket_price: metadata.ticket_price || 0,
        is_published: metadata.is_published || '0x01',
        is_deleted: metadata.is_deleted || '0x00',
        is_featured: metadata.is_featured || '0x01',
        subscriber_count: metadata.subscriber_count || 0
      },
      cover: coverFile ? {
        filename: coverFilename,
        mimeType: coverMimeType,
        base64: coverBase64,
        dataUrl: coverDataUrl
      } : null
    };
  }

  /**
   * Generates a starter zip template and triggers browser download
   */
  static async downloadSampleZip() {
    if (!window.JSZip) {
      throw new Error('JSZip library is not loaded.');
    }

    const zip = new window.JSZip();

    const sampleEvent = {
      title: "Ancient Mathematics: The Sulba Sutras and Geometry",
      primary_speaker: "Prof. K. Ramasubramanian",
      start_time: "2026-11-20 16:00:00.000000",
      minutes: 90,
      location: "Zoom Online Webinar",
      status: "upcoming",
      cover_image: "assets/images/sulba-sutras.jpg",
      youtube_id: "",
      amazon_url: "https://www.amazon.com/dp/example",
      registration_url: "https://indicforum.org/register",
      joining_information: "Zoom Webinar link will be sent to registered participants 24 hours prior to the session.",
      moderator: "Akshar Prabhudesai",
      whatsapp_url: "https://rebrand.ly/ifwap",
      contact_email: "contact@indiccouncil.org"
    };

    const sampleMd = `# Ancient Mathematics: The Sulba Sutras and Geometry\n\nYou are cordially invited to an in-depth seminar on the geometrical traditions of the Sulba Sutras with **Prof. K. Ramasubramanian**.\n\n### About the Speaker\nProf. K. Ramasubramanian is an esteemed scholar of Indian astronomy and mathematics, recipient of the Maharshi Badrayan Vyas Samman.\n\n### About the Talk\nThe Sulba Sutras represent some of the earliest recorded mathematical and geometric texts in the ancient world, codifying principles centuries before Pythagoras.\n\n### How to Attend\nPlease register using the link above. All attendees will receive Zoom coordinates prior to the session.`;

    zip.file("event.json", JSON.stringify(sampleEvent, null, 2));
    zip.file("description.md", sampleMd);

    // Create a 1x1 placeholder SVG/JPEG for cover
    const svgCover = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#1c1917"/>
  <rect x="40" y="40" width="1120" height="550" rx="16" fill="#292524" stroke="#d97706" stroke-width="4"/>
  <text x="600" y="280" font-family="serif" font-size="44" font-weight="bold" fill="#fef3c7" text-anchor="middle">Ancient Mathematics: The Sulba Sutras</text>
  <text x="600" y="360" font-family="sans-serif" font-size="28" fill="#d97706" text-anchor="middle">Prof. K. Ramasubramanian</text>
  <text x="600" y="430" font-family="sans-serif" font-size="20" fill="#a8a29e" text-anchor="middle">IndicForum.org • Live Webinar</text>
</svg>`;
    zip.file("cover.svg", svgCover);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "indicforum-sample-event.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

window.ZipHandler = ZipHandler;
