package domain

import (
	"math"
	"testing"
	"time"
)

func TestRUT(t *testing.T) {
	for _, s := range []string{"12.345.678-5", "123456785", " 12.345.678-5 "} {
		got, err := NormalizeRUT(s)
		if err != nil || got != "12345678-5" {
			t.Fatalf("%s: %s %v", s, got, err)
		}
	}
	for _, s := range []string{"12345678-4", "", "1-9", "00000000-0", "1234567X-5"} {
		if _, err := NormalizeRUT(s); err == nil {
			t.Errorf("accepted %q", s)
		}
	}
}
func TestMoney(t *testing.T) {
	for _, tc := range []struct{ net, vat, total int64 }{{0, 0, 0}, {1, 0, 1}, {3, 1, 4}, {100, 19, 119}, {1001, 190, 1191}} {
		m, e := MoneyFromNet(tc.net)
		if e != nil || m.Net != tc.net || m.VAT != tc.vat || m.Total != tc.total || m.IVAIncluded != tc.vat {
			t.Fatal(m, e)
		}
	}
	if _, e := MoneyFromNet(math.MaxInt64); e == nil {
		t.Fatal("overflow accepted")
	}
	if _, e := DiscountedLine(math.MaxInt64, 2, 0); e == nil {
		t.Fatal("line overflow accepted")
	}
	n, e := DiscountedLine(999, 3, 10)
	if e != nil || n != 2697 {
		t.Fatal(n, e)
	}
	vat, total, e := Totals(n)
	if e != nil || vat != 512 || total != 3209 {
		t.Fatal(vat, total, e)
	}
	if _, _, e = Totals(-1); e == nil {
		t.Fatal("negative")
	}
	if _, e = DiscountedLine(100, 1, 101); e == nil {
		t.Fatal("discount")
	}
}
func TestCivilDatesAcrossDST(t *testing.T) {
	for _, s := range []string{"2026-04-04", "2026-09-05"} {
		next, e := AddDays(s, 1)
		if e != nil {
			t.Fatal(e)
		}
		back, e := AddDays(next, -1)
		if e != nil || back != s {
			t.Fatal(next, back, e)
		}
	}
	stamp := time.Date(2026, 10, 8, 1, 0, 0, 0, time.UTC)
	if LocalDate(stamp) != "2026-10-07" {
		t.Fatal(LocalDate(stamp))
	}
	if !ValidID(UUID()) || ValidID("not-an-id") {
		t.Fatal("uuid")
	}
}
