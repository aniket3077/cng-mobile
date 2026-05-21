import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { crowdApi } from '../lib/api';

type CrowdLevel = 'low' | 'medium' | 'high';

interface Props {
  visible: boolean;
  stationId: string;
  stationName: string;
  currentCrowd?: string | null;
  onClose: () => void;
  onUpdated: (crowdLevel: CrowdLevel, waitTime: number) => void;
}

const CROWD_OPTIONS: {
  level: CrowdLevel;
  label: string;
  emoji: string;
  desc: string;
  wait: string;
  colors: [string, string];
  iconColor: string;
  icon: string;
}[] = [
  {
    level: 'low',
    label: 'Low',
    emoji: '🟢',
    desc: 'No queue, refuel immediately',
    wait: '~5 min',
    colors: ['#064E3B', '#065F46'],
    iconColor: '#10B981',
    icon: 'checkmark-circle',
  },
  {
    level: 'medium',
    label: 'Medium',
    emoji: '🟡',
    desc: 'Short queue, some waiting',
    wait: '~15 min',
    colors: ['#451A03', '#78350F'],
    iconColor: '#F59E0B',
    icon: 'time',
  },
  {
    level: 'high',
    label: 'High',
    emoji: '🔴',
    desc: 'Long queue, significant wait',
    wait: '~30 min',
    colors: ['#450A0A', '#7F1D1D'],
    iconColor: '#EF4444',
    icon: 'warning',
  },
];

export default function CrowdUpdateModal({
  visible,
  stationId,
  stationName,
  currentCrowd,
  onClose,
  onUpdated,
}: Props) {
  const [selected, setSelected] = useState<CrowdLevel | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selected) {
      Alert.alert('Select crowd level', 'Please choose a crowd level to report.');
      return;
    }

    setSubmitting(true);
    try {
      await crowdApi.update(stationId, selected);
      const opt = CROWD_OPTIONS.find((o) => o.level === selected)!;
      const waitMap: Record<CrowdLevel, number> = { low: 5, medium: 15, high: 30 };
      onUpdated(selected, waitMap[selected]);
      Alert.alert(
        'Thanks! 🙌',
        `Crowd update reported as "${opt.label}". Your contribution helps other drivers!`
      );
      setSelected(null);
      onClose();
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to update. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Update Crowd Level</Text>
              <Text style={styles.stationName} numberOfLines={1}>
                {stationName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {currentCrowd && (
            <View style={styles.currentBadge}>
              <Ionicons name="information-circle-outline" size={14} color="#60A5FA" />
              <Text style={styles.currentBadgeText}>
                Currently reported as{' '}
                <Text style={{ fontWeight: '700' }}>{currentCrowd}</Text>
              </Text>
            </View>
          )}

          <Text style={styles.prompt}>What's the crowd like right now?</Text>

          {CROWD_OPTIONS.map((opt) => {
            const isSelected = selected === opt.level;
            return (
              <TouchableOpacity
                key={opt.level}
                activeOpacity={0.88}
                onPress={() => setSelected(opt.level)}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={opt.colors}
                    style={styles.optionGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name={opt.icon as any} size={26} color={opt.iconColor} />
                    <View style={styles.optionText}>
                      <Text style={styles.optionLabelSelected}>
                        {opt.emoji} {opt.label}
                      </Text>
                      <Text style={styles.optionDescSelected}>{opt.desc}</Text>
                    </View>
                    <View style={styles.waitBadge}>
                      <Text style={styles.waitText}>{opt.wait}</Text>
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={styles.optionInner}>
                    <Ionicons name={opt.icon as any} size={26} color={opt.iconColor} />
                    <View style={styles.optionText}>
                      <Text style={styles.optionLabel}>
                        {opt.emoji} {opt.label}
                      </Text>
                      <Text style={styles.optionDesc}>{opt.desc}</Text>
                    </View>
                    <View style={[styles.waitBadge, { backgroundColor: `${opt.iconColor}20` }]}>
                      <Text style={[styles.waitText, { color: opt.iconColor }]}>{opt.wait}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <View style={styles.disclaimer}>
            <Ionicons name="people-outline" size={14} color="#60A5FA" />
            <Text style={styles.disclaimerText}>
              Crowd reports are averaged across recent user updates. Thank you for helping the community!
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!selected || submitting}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={selected ? ['#2563EB', '#1D4ED8'] : ['#CBD5E1', '#CBD5E1']}
              style={styles.submitBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitText}>Report Crowd Level</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#F8FAFC' },
  stationName: { fontSize: 13, color: '#60A5FA', marginTop: 3, maxWidth: 240 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  currentBadgeText: { color: '#93C5FD', fontSize: 13 },

  prompt: { color: '#94A3B8', fontSize: 14, marginBottom: 14 },

  optionCard: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  optionCardSelected: { borderColor: '#3B82F6' },
  optionGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  optionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: '#1E293B',
  },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 16, fontWeight: '700', color: '#CBD5E1' },
  optionLabelSelected: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  optionDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  optionDescSelected: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  waitBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  waitText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 16,
  },
  disclaimerText: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 16,
    gap: 8,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
