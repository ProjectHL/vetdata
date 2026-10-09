package domain

import (
	"bytes"
	"encoding/json"
	"fmt"
	"time"
)

// Patient statuses computed by the server. The clinical meaning of each
// status is NOT decided here: rules arrive as configuration (D-03) and the
// compiled default only uses administrative signals.
const (
	StatusOK      = "Al día"
	StatusControl = "Control"
	StatusUrgent  = "Urgente"
)

// StatusMatcher is a single OR condition inside a status rule.
type StatusMatcher struct {
	DiagnosisCategory      []string `json:"diagnosisCategory"`
	Condition              []string `json:"condition"`
	OverdueVaccine         bool     `json:"overdueVaccine"`
	RecentConsultationDays int      `json:"recentConsultationDays"`
}

// StatusRule assigns a status when any of its matchers hits. Rules evaluate
// in order; the first matching rule wins.
type StatusRule struct {
	Status string          `json:"status"`
	Any    []StatusMatcher `json:"any"`
}

// StatusRules is the configurable PatientStatus policy.
type StatusRules struct {
	Default string       `json:"default"`
	Rules   []StatusRule `json:"rules"`
}

// StatusConsultation is the minimal clinical input for evaluation.
type StatusConsultation struct {
	Category string
	Date     string
}

// StatusInput gathers everything the rules may inspect.
type StatusInput struct {
	Today         string
	Consultations []StatusConsultation
	NextDoses     []string
	Conditions    []string
}

// DefaultPatientStatusRules returns the provisional policy: only an overdue
// vaccine moves a patient to Control; Urgente is config-only. Clinical tuning
// belongs to D-03, not to this default.
func DefaultPatientStatusRules() StatusRules {
	return StatusRules{
		Default: StatusOK,
		Rules: []StatusRule{
			{Status: StatusControl, Any: []StatusMatcher{{OverdueVaccine: true}}},
		},
	}
}

// ParsePatientStatusRules validates a JSON policy. Unknown statuses, unknown
// fields and non-positive day windows are rejected.
func ParsePatientStatusRules(data string) (StatusRules, error) {
	if data == "" {
		return DefaultPatientStatusRules(), nil
	}
	var rules StatusRules
	dec := json.NewDecoder(bytes.NewBufferString(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&rules); err != nil {
		return StatusRules{}, fmt.Errorf("invalid status rules: %w", err)
	}
	switch rules.Default {
	case StatusOK, StatusControl, StatusUrgent:
	default:
		return StatusRules{}, fmt.Errorf("invalid default status %q", rules.Default)
	}
	for _, rule := range rules.Rules {
		switch rule.Status {
		case StatusOK, StatusControl, StatusUrgent:
		default:
			return StatusRules{}, fmt.Errorf("invalid rule status %q", rule.Status)
		}
		if len(rule.Any) == 0 {
			return StatusRules{}, fmt.Errorf("rule %q has no matchers", rule.Status)
		}
		for _, m := range rule.Any {
			if m.RecentConsultationDays < 0 {
				return StatusRules{}, fmt.Errorf("negative recentConsultationDays")
			}
		}
	}
	return rules, nil
}

func recentCutoff(today string, days int) string {
	date, err := time.Parse("2006-01-02", today)
	if err != nil {
		return today
	}
	return date.AddDate(0, 0, -days).Format("2006-01-02")
}

// Evaluate applies the policy to the input. First matching rule wins.
func (rules StatusRules) Evaluate(in StatusInput) string {
	for _, rule := range rules.Rules {
		for _, m := range rule.Any {
			if m.OverdueVaccine {
				for _, next := range in.NextDoses {
					if next != "" && next < in.Today {
						return rule.Status
					}
				}
			}
			if len(m.DiagnosisCategory) > 0 {
				for _, c := range in.Consultations {
					for _, want := range m.DiagnosisCategory {
						if c.Category == want {
							return rule.Status
						}
					}
				}
			}
			if len(m.Condition) > 0 {
				for _, have := range in.Conditions {
					for _, want := range m.Condition {
						if have == want {
							return rule.Status
						}
					}
				}
			}
			if m.RecentConsultationDays > 0 {
				cutoff := recentCutoff(in.Today, m.RecentConsultationDays)
				for _, c := range in.Consultations {
					if c.Date >= cutoff && c.Date <= in.Today {
						return rule.Status
					}
				}
			}
		}
	}
	return rules.Default
}
