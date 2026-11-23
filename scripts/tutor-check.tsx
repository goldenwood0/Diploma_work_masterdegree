// Isolated browser fixture. No production users, persistent progress or real AI.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import LanguageProvider, { useLanguage } from '../src/i18n/LanguageProvider';
import AiTutorPanel from '../src/components/AiTutorPanel';
import '../src/index.css';
function Fixture() {
  const { setLanguage, setExplanationLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [lesson, setLesson] = useState('fixture');
  const [lessonSlugs, setLessonSlugs] = useState<string[] | null>(null);
  async function start(language: 'ru' | 'kk' | 'en', state: string) {
    const response = await fetch(`/api/tutor-fixture?language=${language}&state=${state}`, { headers: { 'X-ZhPath-Request': '1' } });
    if (!response.ok) throw new Error('Start the isolated tutor harness');
    const fixture = await response.json();
    setLessonSlugs(fixture.lessonSlugs ?? null);
    setLanguage(language); setExplanationLanguage(language); setOpen(true);
  }
  const actualLesson = lessonSlugs ? lessonSlugs[['fixture', 'draft', 'locked'].indexOf(lesson)] : lesson;
  return <main className="p-6"><h1>TEST ONLY — temporary fixtures / no real AI</h1>
    <p>Commands in message: FAIL_ONCE (retry), SLOW (cancel), TIMEOUT.</p>
    <label>Fixture lesson<select value={lesson} onChange={e => setLesson(e.target.value)}><option value="fixture">Published lesson</option><option value="draft">Draft lesson</option><option value="locked">Locked lesson</option><option value="">No lesson</option></select></label>
    <div className="flex flex-wrap gap-4">{(['ru', 'kk', 'en'] as const).map(language => <React.Fragment key={language}><button onClick={() => void start(language, 'test')}>{language} TEST</button><button onClick={() => void start(language, 'unconfigured')}>{language} OFF</button></React.Fragment>)}</div>
    {open && <AiTutorPanel lessonSlug={actualLesson || undefined} onClose={() => setOpen(false)} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Fixture /></LanguageProvider>);
