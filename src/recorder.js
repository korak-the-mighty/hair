/* Neon Drive — record the drive (picture + soundtrack) to a video file.
 *
 * Frames are captured from a dedicated fixed-size canvas (1080p by default,
 * 4K with ?rec=4k) so recordings don't depend on the window size. Where the
 * browser supports the File System Access API (Chrome, Edge) the video is
 * streamed straight to disk, so multi-hour mixtape recordings don't fill RAM;
 * elsewhere it's kept in memory and downloaded when recording stops.
 */
(function () {
  'use strict';
  const ND = window.ND;

  class Recorder {
    constructor(scale) {
      this.scale = scale || 3;
      this.canvas = ND.canvas(ND.W * this.scale, ND.H * this.scale);
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.ctx.imageSmoothingEnabled = false;
      this.rec = null;
    }
    get active() { return !!this.rec; }
    get elapsed() { return this.rec ? (performance.now() - this.t0) / 1000 : 0; }

    supported() {
      return typeof MediaRecorder !== 'undefined' && !!this.canvas.captureStream;
    }

    // Called every presented frame.
    frame(scene) {
      if (!this.rec) return;
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(scene, 0, 0, this.canvas.width, this.canvas.height);
    }

    async start(music, scene) {
      if (!this.supported()) throw new Error('This browser cannot record video (no MediaRecorder).');
      this.frame(scene);
      const video = this.canvas.captureStream(60);
      const tracks = [...video.getVideoTracks()];
      if (music && music.n && music.n.rec) tracks.push(...music.n.rec.stream.getAudioTracks());
      const stream = new MediaStream(tracks);
      const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4'];
      this.mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const ext = this.mime.includes('mp4') ? 'mp4' : 'webm';
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      this.name = `neon-drive-${stamp}.${ext}`;
      this.writable = null;
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: this.name,
            types: [{ description: 'Video', accept: { [ext === 'mp4' ? 'video/mp4' : 'video/webm']: ['.' + ext] } }],
          });
          this.writable = await handle.createWritable();
        } catch (e) {
          if (e && e.name === 'AbortError') return false; // the viewer cancelled the save dialog
          this.writable = null; // not allowed here: fall back to memory
        }
      }
      this.chunks = [];
      this.pending = Promise.resolve();
      const rec = new MediaRecorder(stream, { mimeType: this.mime || undefined, videoBitsPerSecond: this.scale >= 6 ? 40e6 : 16e6, audioBitsPerSecond: 256000 });
      rec.ondataavailable = (e) => {
        if (!e.data || !e.data.size) return;
        if (this.writable) this.pending = this.pending.then(() => this.writable.write(e.data));
        else this.chunks.push(e.data);
      };
      rec.onstop = async () => {
        if (this.writable) {
          await this.pending;
          await this.writable.close();
          this.onsaved && this.onsaved(this.name, true);
        } else {
          const blob = new Blob(this.chunks, { type: this.mime || 'video/webm' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = this.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 60000);
          this.onsaved && this.onsaved(this.name, false);
        }
      };
      rec.start(1000);
      this.rec = rec;
      this.t0 = performance.now();
      return true;
    }

    stop() {
      if (!this.rec) return;
      this.rec.stop();
      this.rec = null;
    }
  }

  ND.Recorder = Recorder;
})();
