import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

interface RoutePlanModalProps {
    visible: boolean;
    onClose: () => void;
    travelMode: 'driving' | 'motorcycle' | 'transit' | 'walking' | 'bicycling';
    setTravelMode: (mode: 'driving' | 'motorcycle' | 'transit' | 'walking' | 'bicycling') => void;
    startingPoint: string;
    setStartingPoint: (text: string) => void;
    destination: string;
    setDestination: (text: string) => void;
    onSearchStartingPoint: (text: string) => void;
    onSearchDestination: (text: string) => void;
    startingSuggestions: any[];
    showStartingSuggestions: boolean;
    destinationSuggestions: any[];
    showDestinationSuggestions: boolean;
    onSelectStartingSuggestion: (suggestion: any) => void;
    onSelectDestinationSuggestion: (suggestion: any) => void;
    onSwap: () => void;
    onStartNavigation: () => void;
    destinationCoords: { lat: number; lng: number } | null;
}

const TRAVEL_MODES = [
    { mode: 'driving', icon: 'car-outline', activeIcon: 'car', label: 'Drive' },
    { mode: 'motorcycle', icon: 'bicycle-outline', activeIcon: 'bicycle', label: 'Bike' },
    { mode: 'transit', icon: 'bus-outline', activeIcon: 'bus', label: 'Transit' },
    { mode: 'walking', icon: 'walk-outline', activeIcon: 'walk', label: 'Walk' },
];

export default function RoutePlanModal({
    visible,
    onClose,
    travelMode,
    setTravelMode,
    startingPoint,
    setStartingPoint,
    destination,
    setDestination,
    onSearchStartingPoint,
    onSearchDestination,
    startingSuggestions,
    showStartingSuggestions,
    destinationSuggestions,
    showDestinationSuggestions,
    onSelectStartingSuggestion,
    onSelectDestinationSuggestion,
    onSwap,
    onStartNavigation,
    destinationCoords,
}: RoutePlanModalProps) {
    const suggestions = showStartingSuggestions ? startingSuggestions : destinationSuggestions;
    const showSuggestions = (showStartingSuggestions || showDestinationSuggestions) && suggestions.length > 0;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalContainer}
            >
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Plan Route</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    {/* Travel Modes */}
                    <View style={styles.travelModesContainer}>
                        {TRAVEL_MODES.map((item) => {
                            const isActive = travelMode === item.mode;
                            return (
                                <TouchableOpacity
                                    key={item.mode}
                                    style={[
                                        styles.travelModeButton,
                                        isActive && styles.travelModeActive,
                                    ]}
                                    onPress={() => setTravelMode(item.mode as any)}
                                >
                                    <Ionicons
                                        name={(isActive ? item.activeIcon : item.icon) as any}
                                        size={22}
                                        color={isActive ? '#fff' : colors.textSecondary}
                                    />
                                    <Text style={[
                                        styles.travelModeLabel,
                                        isActive && styles.travelModeLabelActive
                                    ]}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Route Inputs */}
                    <View style={styles.inputsContainer}>
                        {/* Timeline Visual */}
                        <View style={styles.timelineContainer}>
                            <View style={[styles.dot, styles.dotStart]} />
                            <View style={styles.line} />
                            <View style={[styles.dot, styles.dotEnd]} />
                        </View>

                        <View style={styles.inputsWrapper}>
                            {/* Starting Point */}
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Your location"
                                    placeholderTextColor="#9CA3AF"
                                    value={startingPoint}
                                    onChangeText={(text) => {
                                        setStartingPoint(text);
                                        onSearchStartingPoint(text);
                                    }}
                                />
                                {startingPoint.length > 0 && startingPoint !== 'Your location' && (
                                    <TouchableOpacity
                                        onPress={() => setStartingPoint('Your location')}
                                        style={styles.clearButton}
                                    >
                                        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Destination */}
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Choose destination"
                                    placeholderTextColor="#9CA3AF"
                                    value={destination}
                                    onChangeText={(text) => {
                                        setDestination(text);
                                        onSearchDestination(text);
                                    }}
                                />
                                {destination.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setDestination('')}
                                        style={styles.clearButton}
                                    >
                                        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Swap Button */}
                        <TouchableOpacity style={styles.swapButton} onPress={onSwap}>
                            <MaterialIcons name="swap-vert" size={22} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Suggestions List */}
                    {showSuggestions && (
                        <ScrollView
                            style={styles.suggestionsList}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {suggestions.map((item, index) => (
                                <TouchableOpacity
                                    key={item?.placeId || index}
                                    style={styles.suggestionItem}
                                    onPress={() =>
                                        showStartingSuggestions
                                            ? onSelectStartingSuggestion(item)
                                            : onSelectDestinationSuggestion(item)
                                    }
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.suggestionIcon}>
                                        <Ionicons name="location" size={18} color={colors.primary} />
                                    </View>
                                    <View style={styles.suggestionTextContainer}>
                                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                                            {item?.mainText || item?.description}
                                        </Text>
                                        {item?.secondaryText ? (
                                            <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                                                {item.secondaryText}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <Ionicons name="arrow-forward" size={16} color="#D1D5DB" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Start Button */}
                    <TouchableOpacity
                        style={[
                            styles.startButton,
                            !destinationCoords && styles.startButtonDisabled
                        ]}
                        onPress={() => {
                            console.log('Start button pressed, destinationCoords:', destinationCoords);
                            onStartNavigation();
                        }}
                        disabled={!destinationCoords}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={destinationCoords ? "navigate" : "locate-outline"}
                            size={20}
                            color="#fff"
                            style={{ marginRight: 8 }}
                        />
                        <Text style={styles.startButtonText}>
                            {destinationCoords ? 'Start Navigation' : 'Select Destination'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-start',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        paddingTop: Platform.OS === 'ios' ? 50 : 35,
        paddingHorizontal: 20,
        paddingBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    closeButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        letterSpacing: -0.3,
    },
    travelModesContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 10,
    },
    travelModeButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    travelModeActive: {
        backgroundColor: colors.primary,
    },
    travelModeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textSecondary,
        marginTop: 2,
    },
    travelModeLabelActive: {
        color: '#fff',
    },
    inputsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    timelineContainer: {
        alignItems: 'center',
        marginRight: 12,
        height: 76,
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    dotStart: {
        backgroundColor: '#3B82F6',
    },
    dotEnd: {
        backgroundColor: '#EF4444',
    },
    line: {
        width: 2,
        flex: 1,
        backgroundColor: '#D1D5DB',
        marginVertical: 4,
    },
    inputsWrapper: {
        flex: 1,
        gap: 10,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    clearButton: {
        padding: 4,
    },
    swapButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
    },
    suggestionsList: {
        maxHeight: 220,
        marginBottom: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingVertical: 4,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    suggestionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    suggestionTextContainer: {
        flex: 1,
        marginRight: 8,
    },
    suggestionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    suggestionSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 14,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    startButtonDisabled: {
        backgroundColor: '#9CA3AF',
        shadowOpacity: 0,
    },
    startButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
});
