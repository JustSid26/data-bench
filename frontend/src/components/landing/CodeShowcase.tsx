import { useLayoutEffect, useRef } from "react";
import { Icon } from "../icons";
import { MOTION_OK, gsap } from "../../lib/gsap";

/* An excerpt of a script DataBench actually exported (random forest on the
   Titanic data, 300 trees, depth 8), and the output of running it outside
   DataBench -- the same 0.7688 the app reported. */
const CODE: { text: string; kind?: "comment" | "key" | "hot" }[] = [
  { text: '"""Random forest predicting `Survived` — exported from DataBench"""', kind: "comment" },
  { text: "" },
  { text: "NUMERIC = ['Age', 'Fare', 'Pclass', 'SibSp', 'Parch']" },
  { text: "CATEGORICAL = ['Sex', 'Cabin', 'Embarked']" },
  { text: "TEST_SIZE = 0.2" },
  { text: "THRESHOLD = 0.5819  # tuned by DataBench for balanced classes", kind: "comment" },
  { text: "" },
  { text: "preprocess = ColumnTransformer([", kind: "key" },
  { text: '    ("numeric", Pipeline([...SimpleImputer("median")]), NUMERIC),' },
  { text: '    ("categorical", Pipeline([...OneHotEncoder(...)]), CATEGORICAL),' },
  { text: "])" },
  { text: "model = RandomForestClassifier(class_weight='balanced', max_depth=8,", kind: "hot" },
  { text: "                               n_estimators=300, random_state=0)", kind: "hot" },
  { text: 'pipeline = Pipeline([("prepare", preprocess), ("model", model)])' },
  { text: "pipeline.fit(X_train, y_train)" },
  { text: 'joblib.dump(pipeline, "databench_random_forest_survived.joblib")' },
];

export function CodeShowcase() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(MOTION_OK, () => {
      const timeline = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 70%", once: true } });
      timeline
        .from(".code-line", { opacity: 0, x: -8, duration: 0.35, stagger: 0.045, ease: "power2.out" })
        .fromTo(".code-hot", { backgroundColor: "rgba(0,0,0,0)" }, { backgroundColor: "var(--accent-soft)", duration: 0.4 }, "-=0.2")
        .from(".code-run", { opacity: 0, y: 8, duration: 0.4, stagger: 0.25, ease: "power2.out" }, "+=0.2");
    }, root);
    return () => media.revert();
  }, []);

  return (
    <div ref={root} className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div>
        <p className="text-[12px] font-semibold tracking-[0.08em] text-accent-fg uppercase">Export</p>
        <h2 className="font-display mt-2 text-[32px] leading-[1.08] font-bold tracking-[-0.03em] md:text-[44px]">Your model, as code you own.</h2>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-muted">
          One click turns any trained model into a standalone scikit-learn script: the same columns, preprocessing,
          hyperparameters, split and decision threshold. Run it anywhere — it reproduces DataBench&apos;s score and saves the
          fitted model.
        </p>
        <ul className="mt-6 space-y-2.5 text-[14px]">
          {["No DataBench needed to run it", "Every setting you tuned, baked in", "Verified: each export is tested against the app's score"].map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <span className="grid size-5 place-items-center rounded-full bg-good/15 text-good">
                <Icon name="tick" className="size-3" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass-sheet overflow-hidden rounded-[20px] border border-line" role="img" aria-label="An exported Python script and its output, matching DataBench's score of 0.7688">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-[11px] text-ink-muted">databench_random_forest_survived.py</span>
        </div>
        <pre className="overflow-x-auto px-4 py-4 font-mono text-[12px] leading-[1.7]">
          {CODE.map((line, i) => (
            <div
              key={i}
              className={`code-line -mx-2 rounded px-2 ${line.kind === "hot" ? "code-hot" : ""} ${
                line.kind === "comment" ? "text-ink-faint" : line.kind === "key" ? "text-accent-fg" : "text-ink"
              }`}
            >
              <span className="mr-4 inline-block w-5 text-right text-ink-faint/60 select-none">{i + 1}</span>
              {line.text || " "}
            </div>
          ))}
        </pre>
        <div className="border-t border-line bg-hover/60 px-4 py-3 font-mono text-[12px]">
          <p className="code-run text-ink-muted">$ python databench_random_forest_survived.py titanic.csv</p>
          <p className="code-run mt-1">
            balanced accuracy: <span className="font-semibold text-good">0.7688</span>
            <span className="ml-3 text-ink-faint">← identical to DataBench</span>
          </p>
          <p className="code-run text-ink-muted">saved databench_random_forest_survived.joblib</p>
        </div>
      </div>
    </div>
  );
}
