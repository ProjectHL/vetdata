-- T3-8: firma del autor en adjuntos (auditoría ya registra el actor).
ALTER TABLE attachments ADD COLUMN actor_id UUID REFERENCES users(id);
