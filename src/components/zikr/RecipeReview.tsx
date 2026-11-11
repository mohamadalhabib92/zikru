import { useWindowDimensions, View } from 'react-native';
import { KbInput } from '@/ui/keyboard-done';
import { LBtn } from '@/components/zikr/parts';
import { namesByValue, wahidAhadHayy } from '@/lib/istikhraj';
import { L } from '@/lib/l10n';
import type { ParsedRecipe, RecipeFormula, RecipeStage } from '@/lib/recipe-parse';
import { Arabic, LMuted } from '@/ui/light';
import { Text } from '@/ui/Text';
import { brand as b, fonts, theme as t } from '@/ui/theme';

const field = () => ({ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: b.line, backgroundColor: b.paper, paddingHorizontal: 12, color: b.ink }) as const;
const hasAr = (s: string) => /[\u0600-\u06FF]/.test(s);

function Source({ text, marks }: { text: string; marks: string[] }) {
  const body = hasAr(text) ? (
    <Arabic size={18} style={{ marginTop: 4 }}>{text}</Arabic>
  ) : (
    <Text style={{ color: b.ink, fontSize: 15, marginTop: 4 }}>{text}</Text>
  );
  return (
    <View style={{ flex: 1, backgroundColor: b.cream, borderRadius: 10, padding: 8, minWidth: 140 }}>
      <LMuted style={{ fontSize: 12, fontWeight: '700' }}>{L('Texte source')}</LMuted>
      {body}
      {marks.filter(Boolean).map((m) => (
        <Text key={m} style={{ color: t.warning, fontWeight: '700', marginTop: 6, backgroundColor: t.warning + '22' }}>
          {L('Passage incertain : {t}', { t: m })}
        </Text>
      ))}
    </View>
  );
}

const ROLE = { prerequisite: 'Prérequis optionnel', step: 'Étape', invocation: 'Invocation finale' } as const;

function FormulaRow({ formula, index, onChange }: { formula: RecipeFormula; index: number; onChange: (f: RecipeFormula) => void }) {
  return (
    <View style={{ gap: 6, marginTop: 8 }}>
      <Text style={{ color: b.ink, fontWeight: '800' }}>{formula.label}</Text>
      <KbInput
        value={formula.ar}
        onChangeText={(ar) => onChange({ ...formula, ar, sure: false })}
        multiline
        autoCorrect={false}
        spellCheck={false}
        style={[field(), { fontFamily: fonts.quran, fontSize: 22, lineHeight: 40, textAlign: 'right', writingDirection: 'rtl', paddingVertical: 8 }]}
        accessibilityLabel={L('Formule {n}', { n: index + 1 })}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: b.ink, fontWeight: '700' }}>×</Text>
        <KbInput
          value={String(formula.count)}
          onChangeText={(v) => {
            const n = parseInt(v.replace(/[^\d]/g, ''), 10);
            onChange({ ...formula, count: Number.isFinite(n) ? n : 0, countRaw: v, sure: false });
          }}
          keyboardType="number-pad"
          style={[field(), { width: 88, textAlign: 'center', borderColor: formula.count >= 1 ? b.line : t.warning }]}
          accessibilityLabel={L('Nombre de répétitions de la formule {n}', { n: index + 1 })}
        />
        {!formula.sure ? <Text style={{ color: t.warning, fontWeight: '700', fontSize: 12 }}>{L('À confirmer')}</Text> : null}
      </View>
    </View>
  );
}

export function RecipeReview({ recipe, onChange }: { recipe: ParsedRecipe; onChange: (r: ParsedRecipe) => void }) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const total = recipe.stages.filter((s) => s.include && s.kind === 'step').reduce((a, s) => a + s.formulas.reduce((b, f) => b + (f.count || 0), 0), 0);
  const hits = namesByValue(total);
  const note = wahidAhadHayy();
  const patch = (i: number, stage: RecipeStage) => onChange({ ...recipe, stages: recipe.stages.map((s, k) => (k === i ? stage : s)) });
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: b.ink, fontWeight: '900', fontSize: 16 }} accessibilityRole="header">{L('Recette comprise')}</Text>
      {recipe.title ? <Text style={{ color: b.ink, fontWeight: '800', fontSize: 18, textAlign: 'right' }}>{recipe.title}</Text> : null}
      {recipe.sourceName ? <LMuted>{L('Source : {t}', { t: recipe.sourceName })}</LMuted> : null}
      {recipe.aim ? <LMuted>{L('But : {t}', { t: recipe.aim })}</LMuted> : null}
      {recipe.variant ? <LMuted>{L('Variante : {t}', { t: recipe.variant })}</LMuted> : null}
      <LMuted>
        {L('Total des répétitions des étapes : {n}', { n: total })}
        {recipe.namedTotal != null ? ' · ' + L('Le texte annonce {n}.', { n: recipe.namedTotal }) : ''}
      </LMuted>
      {hits.length ? (
        <LMuted>{L('Noms de cette valeur : {t}', { t: hits.map((h) => h.ar).join(' · ') })}</LMuted>
      ) : total > 0 ? (
        <LMuted>{L('Aucun des 99 Noms de cette liste ne vaut {n}.', { n: total })}</LMuted>
      ) : null}
      {total === note.total ? (
        <View style={{ gap: 2 }}>
          <LMuted>{L('La note « 50 » additionne trois mots, pas un seul Nom.')}</LMuted>
          {note.parts.map((p) => (
            <Text key={p.ar} style={{ color: b.ink, fontSize: 18, textAlign: 'right', writingDirection: 'rtl' }}>{`${p.ar} · ${p.value}`}</Text>
          ))}
          <LMuted>{L('Ce nom n’est pas dans la liste de Tirmidhī utilisée ici.')}</LMuted>
        </View>
      ) : null}
      {recipe.namesNote ? <LMuted>{recipe.namesNote}</LMuted> : null}
      {recipe.signature ? <LMuted>{recipe.signature}</LMuted> : null}
      <LMuted style={{ fontSize: 12 }}>{L('Vérifiez chaque formule, son nombre et sa dédicace. Rien n’est enregistré avant votre confirmation. Cela reste privé.')}</LMuted>
      {recipe.stages.map((stage, i) => (
        <View key={i} style={{ backgroundColor: b.paper, borderRadius: 14, borderWidth: 1, borderColor: stage.confidence < 0.8 ? t.warning : b.line, padding: 12 }}>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10 }}>
            <View style={{ flex: 1.2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: b.ink, fontWeight: '800' }}>{L(ROLE[stage.kind])}</Text>
                <Text style={{ color: stage.confidence < 0.8 ? t.warning : b.green, fontWeight: '700' }} accessibilityLabel={L('Confiance {n} pour cent', { n: Math.round(stage.confidence * 100) })}>
                  {L('Confiance {n} %', { n: Math.round(stage.confidence * 100) })}
                </Text>
              </View>
              {stage.optional ? (
                <LBtn icon={stage.include ? 'checkbox-outline' : 'square-outline'} label={stage.include ? 'Inclure ce prérequis' : 'Prérequis laissé de côté'} active={stage.include} onPress={() => patch(i, { ...stage, include: !stage.include })} />
              ) : null}
              {stage.formulas.map((f, j) => (
                <FormulaRow
                  key={j}
                  formula={f}
                  index={j}
                  onChange={(formula) => patch(i, { ...stage, formulas: stage.formulas.map((x, k) => (k === j ? formula : x)) })}
                />
              ))}
              <Text style={{ color: b.ink, fontWeight: '700', marginTop: 8 }}>{L('Dédicace')}</Text>
              <KbInput
                value={stage.dedication}
                onChangeText={(dedication) => patch(i, { ...stage, dedication })}
                multiline
                placeholder={L('Aucune dédicace lue')}
                placeholderTextColor={b.inkMuted}
                style={[field(), { marginTop: 4, fontFamily: hasAr(stage.dedication) ? fonts.quran : undefined, fontSize: 18, lineHeight: 32, textAlign: hasAr(stage.dedication) ? 'right' : 'left', writingDirection: hasAr(stage.dedication) ? 'rtl' : 'ltr', paddingVertical: 8 }]}
                accessibilityLabel={L('Dédicace de l’étape {n}', { n: i + 1 })}
              />
              {stage.kind !== 'prerequisite' ? <LBtn icon="trash-outline" label="Retirer cette étape" onPress={() => patch(i, { ...stage, include: false })} /> : null}
              {!stage.include && !stage.optional ? <LMuted>{L('Cette étape ne sera pas enregistrée.')}</LMuted> : null}
            </View>
            <Source text={stage.source} marks={stage.uncertain} />
          </View>
        </View>
      ))}
    </View>
  );
}
