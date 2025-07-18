import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, BackHandler } from 'react-native';

export interface Note {
  id: string;
  text: string;
  subnotes?: Note[];
}

function FlowChartNode({ note, level = 0 }: { note: Note; level?: number }) {
  return (
    <View style={[styles.nodeContainer, { marginLeft: level * 24 }]}>
      <View style={styles.nodeBox}>
        <Text style={styles.nodeText}>{note.text}</Text>
      </View>
      {note.subnotes && note.subnotes.length > 0 && (
        <View style={styles.subnotesContainer}>
          {note.subnotes.map((sub: Note) => (
            <FlowChartNode key={sub.id} note={sub} level={level + 1} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function FlowChartScreen({ route, navigation }: any) {
  const { root } = route.params;

  // Handle Android hardware back button
  useEffect(() => {
    const backAction = () => {
      if (navigation && navigation.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation]);

  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.extractOffset(); // accumulate offset for next drag
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
            ],
          },
        ]}
      >
        <View
          style={{
            minWidth: 1200,
            minHeight: 1200,
            padding: 24,
          }}
        >
          <FlowChartNode note={root} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  nodeContainer: {
    marginBottom: 24,
  },
  nodeBox: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#6cf',
    alignSelf: 'flex-start',
    minWidth: 120,
    marginBottom: 8,
  },
  nodeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  subnotesContainer: {
    marginTop: 4,
  },
});
