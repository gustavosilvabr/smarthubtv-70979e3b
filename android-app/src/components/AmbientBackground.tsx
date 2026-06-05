import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Animated } from "react-native";

export function AmbientBackground() {
  const bubble1TransformX = useRef(new Animated.Value(0)).current;
  const bubble1TransformY = useRef(new Animated.Value(0)).current;
  const bubble1Scale = useRef(new Animated.Value(1)).current;

  const bubble2TransformX = useRef(new Animated.Value(0)).current;
  const bubble2TransformY = useRef(new Animated.Value(0)).current;
  const bubble2Scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const createAnimation = (
      tx: Animated.Value,
      ty: Animated.Value,
      sc: Animated.Value,
      delay: number
    ) => {
      const runX = () => {
        Animated.sequence([
          Animated.timing(tx, {
            toValue: Math.random() * 100 - 50,
            duration: 5000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(tx, {
            toValue: Math.random() * 100 - 50,
            duration: 5000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ]).start(() => runX());
      };

      const runY = () => {
        Animated.sequence([
          Animated.timing(ty, {
            toValue: Math.random() * 100 - 50,
            duration: 5000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(ty, {
            toValue: Math.random() * 100 - 50,
            duration: 5000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ]).start(() => runY());
      };

      const runScale = () => {
        Animated.sequence([
          Animated.timing(sc, {
            toValue: 0.85 + Math.random() * 0.3,
            duration: 4000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(sc, {
            toValue: 0.85 + Math.random() * 0.3,
            duration: 4000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ]).start(() => runScale());
      };

      const timeoutId = setTimeout(() => {
        runX();
        runY();
        runScale();
      }, delay);

      return () => clearTimeout(timeoutId);
    };

    const cleanup1 = createAnimation(bubble1TransformX, bubble1TransformY, bubble1Scale, 0);
    const cleanup2 = createAnimation(bubble2TransformX, bubble2TransformY, bubble2Scale, 500);

    return () => {
      cleanup1();
      cleanup2();
    };
  }, [bubble1TransformX, bubble1TransformY, bubble1Scale, bubble2TransformX, bubble2TransformY, bubble2Scale]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dark Base Background */}
      <View style={styles.darkFill} />
      
      {/* Bubble 1: top center */}
      <Animated.View
        style={[
          styles.bubble,
          styles.bubble1,
          {
            transform: [
              { translateX: bubble1TransformX },
              { translateY: bubble1TransformY },
              { scale: bubble1Scale },
            ],
          },
        ]}
      />
      {/* Bubble 2: bottom left */}
      <Animated.View
        style={[
          styles.bubble,
          styles.bubble2,
          {
            transform: [
              { translateX: bubble2TransformX },
              { translateY: bubble2TransformY },
              { scale: bubble2Scale },
            ],
          },
        ]}
      />
    </View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  darkFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#050308", // Very dark base
  },
  bubble: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 0.18,
  },
  bubble1: {
    top: -150,
    left: width / 2 - 200,
    width: 400,
    height: 400,
    backgroundColor: "#581c87", // purple-700
  },
  bubble2: {
    bottom: -150,
    left: -100,
    width: 300,
    height: 300,
    backgroundColor: "#d946ef", // fuchsia-500
  },
});
