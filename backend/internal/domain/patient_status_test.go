package domain

import "testing"

func TestPatientStatusDefaults(t *testing.T) {
	rules := DefaultPatientStatusRules()
	if got := rules.Evaluate(StatusInput{Today: "2026-10-09"}); got != StatusOK {
		t.Fatal(got)
	}
	in := StatusInput{Today: "2026-10-09", NextDoses: []string{"2026-10-01"}}
	if got := rules.Evaluate(in); got != StatusControl {
		t.Fatal(got)
	}
	in = StatusInput{Today: "2026-10-09", NextDoses: []string{"2026-10-20"}}
	if got := rules.Evaluate(in); got != StatusOK {
		t.Fatal(got)
	}
}

func TestPatientStatusCustomPolicy(t *testing.T) {
	raw := `{"default":"Al día","rules":[
		{"status":"Urgente","any":[{"diagnosisCategory":["Cardiológico"]}]},
		{"status":"Control","any":[{"overdueVaccine":true},{"recentConsultationDays":30},{"condition":["diabetes"]}]}]}`
	rules, err := ParsePatientStatusRules(raw)
	if err != nil {
		t.Fatal(err)
	}
	urgent := StatusInput{Today: "2026-10-09", Consultations: []StatusConsultation{{Category: "Cardiológico", Date: "2026-10-08"}}, NextDoses: []string{"2026-09-01"}}
	if got := rules.Evaluate(urgent); got != StatusUrgent {
		t.Fatal("precedence", got)
	}
	recent := StatusInput{Today: "2026-10-09", Consultations: []StatusConsultation{{Category: "Preventivo / sano", Date: "2026-09-20"}}}
	if got := rules.Evaluate(recent); got != StatusControl {
		t.Fatal("recent", got)
	}
	old := StatusInput{Today: "2026-10-09", Consultations: []StatusConsultation{{Category: "Preventivo / sano", Date: "2026-01-01"}}}
	if got := rules.Evaluate(old); got != StatusOK {
		t.Fatal("old", got)
	}
	chronic := StatusInput{Today: "2026-10-09", Conditions: []string{"diabetes"}}
	if got := rules.Evaluate(chronic); got != StatusControl {
		t.Fatal("condition", got)
	}
}

func TestPatientStatusInvalidPolicy(t *testing.T) {
	for _, raw := range []string{
		`{"default":"Grave","rules":[]}`,
		`{"default":"Al día","rules":[{"status":"Grave","any":[{"overdueVaccine":true}]}]}`,
		`{"default":"Al día","rules":[{"status":"Control","any":[]}]}`,
		`{"default":"Al día","rules":[{"status":"Control","any":[{"recentConsultationDays":-1}]}]}`,
		`{"default":"Al día","rules":[{"status":"Control","any":[{"unknown":true}]}]}`,
		`not json`,
	} {
		if _, err := ParsePatientStatusRules(raw); err == nil {
			t.Fatal("accepted", raw)
		}
	}
	if _, err := ParsePatientStatusRules(""); err != nil {
		t.Fatal(err)
	}
}
