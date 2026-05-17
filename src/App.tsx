import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useAppStore } from './store/useAppStore';
import CameraView from './components/camera/CameraView';
import ChatScreen from './screens/ChatScreen';
import StoriesScreen from './screens/StoriesScreen';
import TabBar from './components/navigation/TabBar';

export default function App() {
  const { currentView, setCurrentView } = useAppStore();
  const controls = useAnimation();

  // Index mapping
  const views = ['chat', 'camera', 'stories'];
  const currentIndex = views.indexOf(currentView);

  useEffect(() => {
    controls.start({ x: `${-currentIndex * 100}vw` }, { type: "spring", stiffness: 300, damping: 30 });
  }, [currentIndex, controls]);

  return (
    <div className="fixed inset-0 bg-[#050505] overflow-hidden font-sans">
      <motion.div 
        className="flex w-[300vw] h-full touch-pan-y"
        animate={controls}
        drag="x"
        dragConstraints={{ left: -window.innerWidth * 2, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, { offset, velocity }) => {
          const swipe = swipePower(offset.x, velocity.x);
          if (swipe < -swipeConfidenceThreshold && currentIndex < 2) {
            setCurrentView(views[currentIndex + 1] as any);
          } else if (swipe > swipeConfidenceThreshold && currentIndex > 0) {
            setCurrentView(views[currentIndex - 1] as any);
          } else {
            controls.start({ x: `${-currentIndex * 100}vw` });
          }
        }}
      >
        <div className="w-[100vw] h-full flex-shrink-0">
          <ChatScreen />
        </div>
        <div className="w-[100vw] h-full flex-shrink-0 relative bg-[#050505]">
          {Math.abs(currentIndex - 1) <= 1 && <CameraView />}
        </div>
        <div className="w-[100vw] h-full flex-shrink-0 bg-[#050505]">
          {Math.abs(currentIndex - 2) <= 1 && <StoriesScreen />}
        </div>
      </motion.div>
      <TabBar />
    </div>
  );
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};
