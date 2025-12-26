import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Dimensions,
    TouchableOpacity,
    Image,
    Animated,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Find CNG Stations',
        description: 'Locate the nearest CNG pumps around you instantly with real-time availability updates.',
        icon: 'location',
        color: '#10B981', // Emerald
    },
    {
        id: '2',
        title: 'Smart Route Planning',
        description: 'Plan your long-distance trips with intelligent CNG stop suggestions along your route.',
        icon: 'map',
        color: '#3B82F6', // Blue
    },
    {
        id: '3',
        title: 'Voice Assistant',
        description: 'Drive safely while finding stations. Just say "Find nearest CNG" or "Navigate to pump".',
        icon: 'mic',
        color: '#8B5CF6', // Purple
    },
    {
        id: '4',
        title: 'Premium Features',
        description: 'Unlock ad-free experience, priority routing, and exclusive deals with our subscription plans.',
        icon: 'star',
        color: '#F59E0B', // Amber
    },
];

interface OnboardingScreenProps {
    navigation: any;
    onComplete: (target?: string) => Promise<void>;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList>(null);

    const handleNext = async () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
        } else {
            await onComplete();
        }
    };

    const skip = async () => {
        await onComplete();
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Background decoration */}
            <View style={styles.backgroundCircle} />

            <FlatList
                ref={flatListRef}
                data={SLIDES}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                keyExtractor={(item) => item.id}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                renderItem={({ item }) => (
                    <View style={styles.slide}>
                        <View style={styles.imageContainer}>
                            <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                                <Ionicons name={item.icon as any} size={80} color={item.color} />
                            </View>
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={[styles.title, { color: item.color }]}>{item.title}</Text>
                            <Text style={styles.description}>{item.description}</Text>
                        </View>
                    </View>
                )}
            />

            <View style={styles.footer}>
                {/* Pagination Dots */}
                <View style={styles.pagination}>
                    {SLIDES.map((_, index) => {
                        const inputRange = [
                            (index - 1) * width,
                            index * width,
                            (index + 1) * width,
                        ];
                        const dotWidth = scrollX.interpolate({
                            inputRange,
                            outputRange: [10, 20, 10],
                            extrapolate: 'clamp',
                        });
                        const opacity = scrollX.interpolate({
                            inputRange,
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: 'clamp',
                        });
                        return (
                            <Animated.View
                                key={index}
                                style={[
                                    styles.dot,
                                    {
                                        width: dotWidth,
                                        opacity,
                                        backgroundColor: SLIDES[index].color,
                                    },
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Buttons */}
                <View style={styles.buttonContainer}>
                    {currentIndex === SLIDES.length - 1 ? (
                        <TouchableOpacity onPress={handleNext} style={styles.button}>
                            <LinearGradient
                                colors={['#10B981', '#059669']}
                                style={styles.gradientButton}
                            >
                                <Text style={styles.buttonText}>Get Started</Text>
                                <Ionicons name="arrow-forward" size={20} color="white" />
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.navButtons}>
                            <TouchableOpacity onPress={skip}>
                                <Text style={styles.skipText}>Skip</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
                                <Ionicons name="arrow-forward" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    backgroundCircle: {
        position: 'absolute',
        top: -height * 0.2,
        right: -width * 0.1,
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width * 0.6,
        backgroundColor: '#F3F4F6',
        zIndex: -1,
    },
    slide: {
        width,
        height,
        alignItems: 'center',
        padding: 20,
        paddingTop: height * 0.15,
    },
    imageContainer: {
        flex: 0.5,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    iconCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    textContainer: {
        flex: 0.3,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 16,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 24,
    },
    footer: {
        height: height * 0.2,
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
    },
    dot: {
        height: 10,
        borderRadius: 5,
        marginHorizontal: 5,
    },
    buttonContainer: {
        marginBottom: 20,
    },
    button: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    gradientButton: {
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    navButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    skipText: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
    },
    nextButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
});
