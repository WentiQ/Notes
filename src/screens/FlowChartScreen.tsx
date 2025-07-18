import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  BackHandler,
  Dimensions,
  TouchableOpacity,
} from 'react-native';

export interface Note {
  id: string;
  text: string;
  subnotes?: Note[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

function FlowChartNode({
  note,
  level = 0,
  onNodePress,
}: {
  note: Note;
  level?: number;
  onNodePress?: (note: Note) => void;
}) {
  return (
    <View style={styles.nodeRow}>
      {level > 0 && (
        <View style={[styles.guideLine, { left: (level - 1) * 24 + 10 }]} />
      )}
      <View style={[styles.nodeContainer, { marginLeft: level * 24 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onNodePress && onNodePress(note)}
        >
          <View style={styles.nodeBox}>
            <Text style={styles.nodeText}>{note.text}</Text>
          </View>
        </TouchableOpacity>
        {note.subnotes && note.subnotes.length > 0 && (
          <View style={styles.subnotesContainer}>
            {note.subnotes.map((sub: Note) => (
              <FlowChartNode
                key={sub.id}
                note={sub}
                level={level + 1}
                onNodePress={onNodePress}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function FlowChartScreen({ route, navigation }: any) {
  const { root } = route.params;

  const [contentSize, setContentSize] = useState({ width: 1200, height: 1200 });

  useEffect(() => {
    const backAction = () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );
    return () => backHandler.remove();
  }, [navigation]);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const deltaX = gestureState.dx;
        const deltaY = gestureState.dy;

        const currX = panOffset.current.x;
        const currY = panOffset.current.y;

        const maxOffsetX = 0;
        const maxOffsetY = 0;

        const minOffsetX =
          SCREEN_WIDTH - Math.max(contentSize.width, SCREEN_WIDTH);
        const minOffsetY =
          SCREEN_HEIGHT - Math.max(contentSize.height, SCREEN_HEIGHT);

        let nextX = currX + deltaX;
        let nextY = currY + deltaY;

        nextX = Math.min(maxOffsetX, Math.max(minOffsetX, nextX));
        nextY = Math.min(maxOffsetY, Math.max(minOffsetY, nextY));

        pan.setValue({ x: nextX, y: nextY });
      },
      onPanResponderRelease: () => {
        // Store the offset for next drag
        const value = (pan as any).__getValue ? (pan as any).__getValue() : { x: 0, y: 0 };
        panOffset.current = {
          x: value.x,
          y: value.y,
        };
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        }}
      >
        <View
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContentSize({ width, height });
          }}
          style={{
            minWidth: 1200,
            minHeight: 1200,
            padding: 24,
          }}
        >
          <FlowChartNode
            note={root}
            onNodePress={(note) => {
              if (navigation && typeof navigation.openNoteDetail === 'function') {
                navigation.openNoteDetail(note);
              }
            }}
          />
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
  nodeRow: {
    flexDirection: 'row',
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
  guideLine: {
    position: 'absolute',
    top: 30,
    bottom: 0,
    width: 2,
    backgroundColor: '#888',
  },
});