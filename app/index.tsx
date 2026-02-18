import { TreeGraph } from '@/components/TreeGraph';
import { supabase } from '@/lib/supabase';
import { FamilyMember, TreeData, Union } from '@/types';
import { buildHierarchy } from '@/utils/hierarchy';
import { buildDeepHierarchy, findAncestors, generateTextReportHTML } from '@/utils/report';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const DEFAULT_PORTRAIT = require('@/assets/images/defaultPortrait.jpg');

export default function TreeScreen() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [unions, setUnions] = useState<Union[]>([]);
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [textExporting, setTextExporting] = useState(false);
  const [focalMemberId, setFocalMemberId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FamilyMember[]>([]);
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
      setUnions(uniqueUnions);

      if (uniqueMembers.length > 0) {
        // If no focal member is set, pick the first one
        let initialFocalId = focalMemberId;
        if (!initialFocalId) {
          const root = uniqueMembers[0];
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
      // Lock to landscape when focus
      async function lockOrientation() {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
      }
      lockOrientation();

      fetchData();

      return () => {
        // Unlock or set back to portrait when leaving if desired
        // For now, let's keep it flexible or return to portrait
        async function unlockOrientation() {
          await ScreenOrientation.unlockAsync();
        }
        unlockOrientation();
      };
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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      const filtered = members.filter(m =>
        m.full_name.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectMember = (member: FamilyMember) => {
    setSearchVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    setFocalMemberId(String(member.id));
  };

  const openSearch = () => {
    setSearchVisible(true);
    setSearchResults(members); // Show all members initially
  };

  const handleExportTextReport = async () => {
    if (members.length === 0) return;

    setTextExporting(true);
    try {
      const ancestors = findAncestors(members, unions);
      if (ancestors.length === 0) {
        Alert.alert('No Ancestors', 'No members with no parents were found.');
        return;
      }

      const deepTrees = ancestors.map(a => buildDeepHierarchy(a, members, unions));
      const html = generateTextReportHTML(deepTrees);

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error: any) {
      Alert.alert('Export Error', error.message);
    } finally {
      setTextExporting(false);
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

      {/* Search FAB */}
      <TouchableOpacity style={styles.searchFab} onPress={openSearch}>
        <Ionicons name="search" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Export Full Ancestor Text Report FAB */}
      <TouchableOpacity
        style={[styles.searchFab, styles.exportFab]}
        onPress={handleExportTextReport}
        disabled={textExporting}
      >
        {textExporting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="list" size={24} color="#fff" />
        )}
      </TouchableOpacity>

      {/* Search Modal */}
      <Modal
        visible={searchVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSearchVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.searchModal}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Search Family</Text>
              <TouchableOpacity onPress={() => {
                setSearchVisible(false);
                setSearchQuery('');
                setSearchResults([]);
              }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name..."
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.id)}
              style={styles.searchResults}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => handleSelectMember(item)}
                >
                  <Image
                    source={item.portrait_url ? { uri: item.portrait_url } : DEFAULT_PORTRAIT}
                    style={styles.searchResultImage}
                    contentFit="cover"
                  />
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.full_name}</Text>
                    <Text style={styles.searchResultDates}>
                      {item.birth_date || 'Unknown'} {item.death_date ? `- ${item.death_date}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchText}>No members found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
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
  searchFab: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  exportFab: {
    top: 120,
    backgroundColor: '#FF9500', // Orange for the full text list
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  searchModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchResults: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultDates: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  emptySearch: {
    padding: 40,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 16,
    color: '#999',
  },
});
