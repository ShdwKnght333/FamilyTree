import { TreeGraph } from '@/components/TreeGraph';
import { supabase } from '@/lib/supabase';
import { FamilyMember, TreeData } from '@/types';
import { buildHierarchy } from '@/utils/hierarchy';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TreeScreen() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [focalMemberId, setFocalMemberId] = useState<string | null>(null);
  const router = useRouter();

  const fetchData = async () => {
    try {
      // Fetch all members in batches
      let membersArray: FamilyMember[] = [];
      let moreMembers = true;
      let memberOffset = 0;
      const BATCH_SIZE = 1000;

      while (moreMembers) {
        const { data, error } = await supabase
          .from('family_members')
          .select('*')
          .order('created_at')
          .range(memberOffset, memberOffset + BATCH_SIZE - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          membersArray = [...membersArray, ...data];
          memberOffset += BATCH_SIZE;
          if (data.length < BATCH_SIZE) moreMembers = false;
        } else {
          moreMembers = false;
        }
      }

      // Fetch all unions in batches
      let unionsArray: any[] = [];
      let moreUnions = true;
      let unionOffset = 0;

      while (moreUnions) {
        const { data, error } = await supabase
          .from('unions')
          .select('*')
          .order('id')
          .range(unionOffset, unionOffset + BATCH_SIZE - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          unionsArray = [...unionsArray, ...data];
          unionOffset += BATCH_SIZE;
          if (data.length < BATCH_SIZE) moreUnions = false;
        } else {
          moreUnions = false;
        }
      }

      const uniqueMembers = Array.from(new Map(membersArray.map(m => [m.id, m])).values());
      const uniqueUnions = Array.from(new Map(unionsArray.map(u => [u.id, u])).values());

      setMembers(uniqueMembers);

      if (uniqueMembers.length > 0) {
        // If no focal member is set, pick the one with no parents or just the first one
        let initialFocalId = focalMemberId;
        if (!initialFocalId) {
          const memberIds = new Set(uniqueMembers.map(m => m.id));
          const root = uniqueMembers.find(m =>
            (!m.father_id || !memberIds.has(m.father_id)) &&
            (!m.mother_id || !memberIds.has(m.mother_id))
          ) || uniqueMembers[0];
          initialFocalId = root.id;
          setFocalMemberId(root.id);
        }

        const hierarchy = buildHierarchy(uniqueMembers, initialFocalId, uniqueUnions);
        setTreeData(hierarchy);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [focalMemberId])
  );

  const handleNodePress = (member: FamilyMember) => {
    if (String(member.id) === String(focalMemberId)) {
      // Tapped the focus node again -> Go to profile
      router.push(`/person/${member.id}`);
    } else {
      // Tapped a different node -> refocus tree
      setFocalMemberId(String(member.id));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (members.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No family members found.</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/add-member')}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add First Member</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {treeData && (
        <TreeGraph
          data={treeData}
          onNodePress={handleNodePress}
          focalMemberId={focalMemberId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabSecondary: {
    bottom: 100,
    backgroundColor: '#34C759',
  },
});
