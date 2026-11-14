"""A few counters about how the service is used, for whoever runs it.

They hold only totals by kind, outcome, risk level and status class: no address, no text, no id,
nothing about a person. They live in memory (a restart starts them again at zero) and are shown in
the Prometheus text format at `/metrics`, which needs a token (see `main.py`).
"""

import threading
from collections import defaultdict

# Seconds from "scan received" to "result ready", including time spent waiting for a free worker.
SCAN_BUCKETS = (0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0)

Labels = tuple[tuple[str, str], ...]


class Metrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counts: dict[tuple[str, Labels], int] = defaultdict(int)
        self._scan_buckets = dict.fromkeys(SCAN_BUCKETS, 0)
        self._scan_total = 0
        self._scan_seconds = 0.0

    def count(self, name: str, **labels: str) -> None:
        with self._lock:
            self._counts[(name, tuple(sorted(labels.items())))] += 1

    def scan_finished(self, seconds: float) -> None:
        with self._lock:
            self._scan_total += 1
            self._scan_seconds += seconds
            for bound in SCAN_BUCKETS:
                if seconds <= bound:
                    self._scan_buckets[bound] += 1

    def render(self) -> str:
        with self._lock:
            counts = dict(self._counts)
            buckets, total, seconds = dict(self._scan_buckets), self._scan_total, self._scan_seconds
        lines: list[str] = []
        for name in sorted({name for name, _ in counts}):
            lines.append(f"# TYPE kavach_{name}_total counter")
            for (counter, labels), value in sorted(counts.items()):
                if counter == name:
                    shown = ",".join(f'{key}="{text}"' for key, text in labels)
                    lines.append(
                        f"kavach_{name}_total{{{shown}}} {value}"
                        if shown
                        else f"kavach_{name}_total {value}"
                    )
        lines.append("# TYPE kavach_scan_seconds histogram")
        lines += [f'kavach_scan_seconds_bucket{{le="{bound}"}} {n}' for bound, n in buckets.items()]
        lines.append(f'kavach_scan_seconds_bucket{{le="+Inf"}} {total}')
        lines.append(f"kavach_scan_seconds_sum {seconds:.3f}")
        lines.append(f"kavach_scan_seconds_count {total}")
        return "\n".join(lines) + "\n"
