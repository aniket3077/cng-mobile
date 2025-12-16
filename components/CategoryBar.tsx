import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native';

interface CategoryBarProps {
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
}

export default function CategoryBar({ fadeAnim, slideAnim }: CategoryBarProps) {
  return (
    <Animated.View style={[styles.categoryBar, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
        <TouchableOpacity style={[styles.categoryPill, styles.categoryPillActive]} activeOpacity={0.8}>
          <View style={styles.iconCircle}>
            <Text style={[styles.categoryIconText, styles.categoryIconActive]}>C</Text>
          </View>
          <Text style={[styles.categoryText, styles.categoryTextActive]}>CNG</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  categoryBar: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryPillActive: {
    backgroundColor: '#E0F2FE',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  categoryIconText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
  },
  categoryIconActive: {
    color: '#FFF',
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  categoryTextActive: {
    color: '#0284C7',
  },
});
