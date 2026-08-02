import { StyleSheet, Text, View } from 'react-native';

interface EmptyPlanStateProps {
  today: Date;
}

export function EmptyPlanState({ today }: EmptyPlanStateProps) {
  const localizedDate = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>План на сегодня</Text>
      <Text style={styles.date}>{localizedDate}</Text>
      <Text style={styles.message}>На этот день пока ничего не запланировано.</Text>
      <Text style={styles.hint}>Первое дело появится в Backlog</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#172033',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  eyebrow: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  date: {
    marginTop: 8,
    color: '#172033',
    fontSize: 24,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  message: {
    marginTop: 24,
    color: '#475467',
    fontSize: 17,
    lineHeight: 25,
  },
  hint: {
    marginTop: 12,
    color: '#344054',
    fontSize: 16,
    fontWeight: '600',
  },
});
