#!/usr/bin/env python3
"""
SAS Visual Analytics BIRD XML Repair Tool
=========================================

This tool helps repair corrupted SAS Visual Analytics report XML files.
Based on SAS Visual Analytics 7.3 and below BIRD XML specifications.

Author: SAS VA Expert
Date: 2024
"""

import xml.etree.ElementTree as ET
import re
import os
import sys
import argparse
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass
from pathlib import Path
import logging
import json
import base64
import zlib

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class ObjectReference:
    """Represents an object reference in the BIRD XML"""
    object_type: str
    object_id: str
    location: str
    line_number: int

class BIRDXMLRepair:
    """
    Main class for repairing SAS Visual Analytics BIRD XML files
    """
    
    def __init__(self, xml_file_path: str):
        self.xml_file_path = xml_file_path
        self.xml_content = ""
        self.root = None
        self.next_unique_name_index = 0
        self.object_mappings = {}
        self.duplicate_objects = {}
        self.null_candidates = set()
        self.defined_ids = set()
        self.referenced_ids = set()
        
        # Object types in order of dependency (for repair operations)
        self.object_types = [
            'DataSourceMappings',
            'Interactions', 
            'Views',
            'MediaSchemes',
            'VisualElements',
            'PromptDefinitions',
            'Actions',
            'Conditions',
            'DataDefinitions',
            'DataSources',
            'CustomSorts',
            'Groupings'
        ]
        
    def load_xml(self) -> bool:
        """Load and parse the XML file"""
        try:
            with open(self.xml_file_path, 'r', encoding='utf-8') as f:
                self.xml_content = f.read()
            
            # Extract nextUniqueNameIndex from first line
            first_line = self.xml_content.split('\n')[0]
            match = re.search(r'nextUniqueNameIndex="(\d+)"', first_line)
            if match:
                self.next_unique_name_index = int(match.group(1))
            
            self.root = ET.fromstring(self.xml_content)
            logger.info(f"Successfully loaded XML file: {self.xml_file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load XML file: {e}")
            return False
    
    def save_xml(self, output_path: Optional[str] = None) -> bool:
        """Save the repaired XML to file, preserving the default namespace (no ns0 prefix)"""
        try:
            if output_path is None:
                base_name = os.path.splitext(self.xml_file_path)[0]
                output_path = f"{base_name}_repaired.xml"

            if self.root is None:
                logger.error("No XML root element to save")
                return False

            # Register the default namespace to avoid ns0 prefix
            m = re.match(r'\{(.+?)\}', self.root.tag)
            default_ns = m.group(1) if m else None
            if default_ns:
                ET.register_namespace('', default_ns)

            # Write XML with formatting to match the working tool
            xml_bytes = ET.tostring(self.root, encoding="utf-8", xml_declaration=True)
            xml_str = xml_bytes.decode("utf-8")
            
            # Remove namespace prefixes like ns0:
            xml_str = re.sub(r"ns\d+:", "", xml_str)
            
            # Replace single quotes in XML declaration with double quotes
            xml_str = re.sub(r"<\?xml version='1.0' encoding='utf-8'\?>", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>", xml_str)
            
            # Use default namespace (xmlns=) instead of xmlns:ns0=
            xml_str = re.sub(r'xmlns:ns0=','xmlns=', xml_str)
            
            # Remove ns0: from element tags if any remain
            xml_str = xml_str.replace('ns0:', '')
            
            # Use &apos; for apostrophes in text content (but not in attribute values)
            def replace_apos_in_text(match):
                text = match.group(1)
                return '>' + text.replace("'", "&apos;") + '<'
            xml_str = re.sub(r'>([^<]*?)<', replace_apos_in_text, xml_str)
            
            # Convert &lt; and &gt; in text nodes back to < and > (but not inside CDATA)
            def unescape_angle_brackets(match):
                text = match.group(1)
                return '>' + text.replace('&lt;', '<').replace('&gt;', '>') + '<'
            xml_str = re.sub(r'>([^<]*?)<', unescape_angle_brackets, xml_str)
            
            # Remove the space that precedes all self-closing tags
            xml_str = re.sub(r' \/>', '/>', xml_str)

            with open(output_path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(xml_str)

            logger.info(f"Repaired XML saved to: {output_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to save XML file: {e}")
            return False
    
    def find_null_candidates(self) -> Set[str]:
        """
        Find null candidates - object IDs that are referenced but not defined
        Returns a set of null candidate IDs
        """
        if self.root is None:
            return set()
        
        # Regex patterns for finding object IDs
        id_check = re.compile(r'[a-z]{2}[0-9]+')
        id_in_text = re.compile(r'(?<![A-Za-z0-9#])[a-z]{2}[0-9]+')
        
        # First pass: collect all defined IDs (name attributes)
        self.defined_ids = set()
        for elem in self.root.iter():
            name = elem.get('name')
            if name and id_check.match(name):
                self.defined_ids.add(name)
        
        # Second pass: collect all referenced IDs
        self.referenced_ids = set()
        for elem in self.root.iter():
            # Check attributes (except name attributes)
            for key, value in elem.attrib.items():
                if key != 'name':
                    for word in value.split():
                        if id_check.match(word):
                            self.referenced_ids.add(word)
            
            # Check element text content
            if elem.text is not None:
                results = id_in_text.findall(elem.text)
                for found in results:
                    self.referenced_ids.add(found)
        
        # Null candidates are referenced but not defined
        self.null_candidates = self.referenced_ids - self.defined_ids
        
        # Filter out known false positives (like HTML colors, labels)
        false_positives = set()
        for candidate in self.null_candidates:
            # Skip if it looks like an HTML color code
            if re.match(r'^[a-fA-F0-9]{6}$', candidate):
                false_positives.add(candidate)
            # Skip if it's a common label pattern
            elif candidate.lower() in ['label', 'title', 'name', 'id']:
                false_positives.add(candidate)
            # Skip if it's 'bi1' (special case to ignore)
            elif candidate == 'bi1':
                false_positives.add(candidate)
        
        self.null_candidates -= false_positives
        
        return self.null_candidates
    
    def repair_null_candidates(self) -> bool:
        """
        Comprehensive repair of null candidates by removing ALL references to them
        """
        logger.info("Starting comprehensive null candidate repair...")
        
        if not self.null_candidates:
            logger.info("No null candidates found")
            return True
        
        logger.info(f"Found {len(self.null_candidates)} null candidates: {sorted(self.null_candidates)}")
        
        if self.root is None:
            return False
        
        # Phase 1: Clean up expressions and attributes that contain null candidate references
        # (More conservative approach - don't remove entire elements, just clean content)
        for elem in self.root.iter():
            # Clean all attributes (except name attributes)
            attrs_to_update = {}
            for key, value in elem.attrib.items():
                if key != 'name' and value and any(nc in value for nc in self.null_candidates):
                    cleaned_value = self._remove_null_candidate_references(value)
                    if cleaned_value != value:
                        attrs_to_update[key] = cleaned_value
                        logger.info(f"Cleaned attribute {key} in {elem.tag}: {value} -> {cleaned_value}")
            
            # Apply attribute updates
            for key, value in attrs_to_update.items():
                elem.attrib[key] = value
            
            # Clean text content (don't remove the element, just clean the text)
            if elem.text is not None and any(nc in elem.text for nc in self.null_candidates):
                cleaned_text = self._remove_null_candidate_references(elem.text)
                if cleaned_text != elem.text:
                    elem.text = cleaned_text
                    logger.info(f"Cleaned text content in {elem.tag}: {cleaned_text[:50]}...")
            
            # Clean tail content
            if elem.tail is not None and any(nc in elem.tail for nc in self.null_candidates):
                cleaned_tail = self._remove_null_candidate_references(elem.tail)
                if cleaned_tail != elem.tail:
                    elem.tail = cleaned_tail
                    logger.info(f"Cleaned tail content in {elem.tag}")
        
        # Phase 2: Remove empty or invalid expressions
        for elem in self.root.iter():
            # Remove elements with empty expressions
            if elem.attrib.get('expression') in ['', '()', '${}']:
                # For ElementTree, we need to find the parent manually
                parent = None
                for potential_parent in self.root.iter():
                    if elem in list(potential_parent):
                        parent = potential_parent
                        break
                
                if parent is not None:
                    parent.remove(elem)
                    logger.info(f"Removed element {elem.tag} with empty expression")
        
        # Update the XML content to reflect changes
        self.xml_content = ET.tostring(self.root, encoding='unicode')
        
        # Phase 3: Iterative cleanup until no more null candidates
        max_iterations = 5
        iteration = 0
        
        while iteration < max_iterations:
            remaining_candidates = self.find_null_candidates()
            if not remaining_candidates:
                logger.info("All null candidates have been successfully repaired")
                break
            
            logger.info(f"Iteration {iteration + 1}: Found {len(remaining_candidates)} remaining null candidates")
            
            # Update null candidates for next iteration
            self.null_candidates = remaining_candidates
            
            # Repeat the cleaning process
            for elem in self.root.iter():
                # Clean all attributes again
                attrs_to_update = {}
                for key, value in elem.attrib.items():
                    if value and any(nc in value for nc in self.null_candidates):
                        cleaned_value = self._remove_null_candidate_references(value)
                        if cleaned_value != value:
                            attrs_to_update[key] = cleaned_value
                
                # Apply attribute updates
                for key, value in attrs_to_update.items():
                    elem.attrib[key] = value
                
                # Clean text content again
                if elem.text is not None and any(nc in elem.text for nc in self.null_candidates):
                    cleaned_text = self._remove_null_candidate_references(elem.text)
                    if cleaned_text != elem.text:
                        elem.text = cleaned_text
            
            iteration += 1
        
        if iteration >= max_iterations:
            logger.warning(f"Reached maximum iterations ({max_iterations}). Some null candidates may remain.")
        
        # Final check
        final_remaining = self.find_null_candidates()
        if final_remaining:
            logger.warning(f"Final remaining null candidates: {final_remaining}")
        else:
            logger.info("✅ All null candidates have been completely repaired")
        
        return True
    
    def _remove_null_candidate_references(self, text: str) -> str:
        """
        Remove references to null candidates from text/expressions
        """
        if not text:
            return text
        
        # Create a copy to work with
        cleaned_text = text
        
        for null_candidate in self.null_candidates:
            # Remove ${null_candidate} patterns
            pattern1 = rf'\$\{{{re.escape(null_candidate)}(?:,[^}}]*)?\}}'
            cleaned_text = re.sub(pattern1, '', cleaned_text)
            
            # Remove standalone null_candidate references
            pattern2 = rf'(?<![A-Za-z0-9#]){re.escape(null_candidate)}(?![A-Za-z0-9])'
            cleaned_text = re.sub(pattern2, '', cleaned_text)
            
            # Clean up any resulting double spaces or commas
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text)
            cleaned_text = re.sub(r',\s*,', ',', cleaned_text)
            cleaned_text = re.sub(r'\(\s*\)', '()', cleaned_text)
        
        return cleaned_text.strip()
    
    def find_duplicate_objects(self) -> Dict[str, List[ObjectReference]]:
        """
        Find problematic duplicate object IDs in the XML
        Returns a dictionary mapping object IDs to their references
        """
        duplicates = {}
        
        if self.root is None:
            return duplicates
        
        # Find all name attributes in the XML
        for elem in self.root.iter():
            if 'name' in elem.attrib:
                obj_id = elem.attrib['name']
                
                if obj_id not in duplicates:
                    duplicates[obj_id] = []
                
                # Determine object type based on element tag (without namespace)
                obj_type = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                location = self._get_element_location(elem)
                
                duplicates[obj_id].append(ObjectReference(
                    object_type=obj_type,
                    object_id=obj_id,
                    location=location,
                    line_number=self._get_line_number(elem)
                ))
        
        # Filter to only include problematic duplicates
        problematic_duplicates = {}
        for obj_id, references in duplicates.items():
            if len(references) > 1:
                # Check if these are legitimate duplicates (like DynVar with same name)
                # or problematic duplicates (like actual object IDs)
                
                # Skip if all references are DynVar elements with the same name
                # (these are legitimate dynamic variables used in different contexts)
                if all(ref.object_type == 'DynVar' for ref in references):
                    continue
                
                # Skip if all references are Category elements in stylesheet
                # (these are legitimate CSS category definitions)
                if all(ref.object_type == 'Category' for ref in references):
                    continue
                
                # Skip if all references are Property elements with the same key
                # (these are legitimate property definitions)
                if all(ref.object_type == 'Property' for ref in references):
                    continue
                
                # Skip if all references are KeyValue elements with the same name
                # (these are legitimate key-value components used in different contexts)
                if all(ref.object_type == 'KeyValue' for ref in references):
                    continue
                
                # Skip if all references are HistogramParm elements with the same name
                # (these are legitimate histogram parameter components used in different contexts)
                if all(ref.object_type == 'HistogramParm' for ref in references):
                    continue
                
                # Include other types of duplicates as problematic
                problematic_duplicates[obj_id] = references
        
        return problematic_duplicates
    
    def find_unused_prompts(self) -> Set[str]:
        """
        Find prompts that are defined but not referenced anywhere in the XML
        Returns a set of unused prompt IDs
        """
        if self.root is None:
            return set()
        
        # Use the same approach as the working fix_report_xml tool
        # Collect all elements with name attributes
        id_used = {}
        id_referenced = set()
        
        # Pass 1: collect all ids used as name attributes
        for elem in self.root.iter():
            name = elem.get("name")
            if name:
                if name not in id_used:
                    id_used[name] = []
                id_used[name].append(elem)
        
        # Pass 2: collect all ids referenced outside name attributes
        for elem in self.root.iter():
            # Check attributes (except name)
            for attr, val in elem.attrib.items():
                if attr == "name":
                    continue
                # Look for prompt IDs in attribute values
                if val in id_used and val.startswith("pr"):
                    id_referenced.add(val)
            
            # Check element text
            if elem.text:
                for prompt_id in id_used.keys():
                    if prompt_id.startswith("pr") and prompt_id in elem.text:
                        id_referenced.add(prompt_id)
            
            # Check element tail
            if elem.tail:
                for prompt_id in id_used.keys():
                    if prompt_id.startswith("pr") and prompt_id in elem.tail:
                        id_referenced.add(prompt_id)
        
        # Find unused prompts (defined but not referenced)
        unused_prompts = {
            pid for pid in id_used.keys()
            if pid.startswith("pr") and pid not in id_referenced
        }
        
        return unused_prompts
    
    def repair_unused_prompts(self) -> bool:
        """
        Remove unused prompts from the XML
        """
        logger.info("Starting unused prompt repair...")
        
        unused_prompts = self.find_unused_prompts()
        if not unused_prompts:
            logger.info("No unused prompts found")
            return True
        
        logger.info(f"Found {len(unused_prompts)} unused prompts: {sorted(unused_prompts)}")
        
        if self.root is None:
            return False
        
        # Build a mapping of child -> parent for easy removal
        parent_map = {}
        for parent in self.root.iter():
            for child in parent:
                parent_map[child] = parent
        
        removed_count = 0
        
        # Remove unused prompt definitions
        for prompt_id in unused_prompts:
            # Find all elements with this prompt ID as name attribute
            for elem in self.root.iter():
                if elem.get('name') == prompt_id:
                    parent = parent_map.get(elem)
                    if parent is not None:
                        parent.remove(elem)
                        removed_count += 1
                        logger.info(f"Removed unused prompt: {prompt_id}")
        
        # Update the XML content to reflect changes
        self.xml_content = ET.tostring(self.root, encoding='unicode')
        
        logger.info(f"✅ Removed {removed_count} unused prompts")
        return True
    
    def _get_element_location(self, elem) -> str:
        """Get a human-readable location description for an element"""
        path = []
        current = elem
        while current is not None:
            if current.tag:
                path.insert(0, current.tag)
            current = current.getparent() if hasattr(current, 'getparent') else None
        
        return " > ".join(path[:3])  # Limit to first 3 levels
    
    def _get_line_number(self, elem) -> int:
        """Get approximate line number for an element"""
        # This is a simplified approach - in practice you might want more sophisticated line tracking
        return 0
    
    def repair_duplicate_names(self) -> bool:
        """
        Repair "Unexpected Second Use of Unique Name" errors
        Based on the documentation repair steps
        """
        logger.info("Starting duplicate name repair...")
        
        duplicates = self.find_duplicate_objects()
        if not duplicates:
            logger.info("No duplicate objects found")
            return True
        
        logger.info(f"Found {len(duplicates)} duplicate object IDs")
        
        for obj_id, references in duplicates.items():
            logger.info(f"Processing duplicate ID: {obj_id} with {len(references)} references")
            
            # Choose one reference to keep, modify the others
            reference_to_keep = references[0]
            references_to_modify = references[1:]
            
            for ref in references_to_modify:
                new_id = f"{obj_id}_{self.next_unique_name_index}"
                self.next_unique_name_index += 1
                
                # Store the original ID for later reference
                if self.root is not None:
                    for elem in self.root.iter():
                        elem_type = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                        if elem.attrib.get('name') == ref.object_id and elem_type == ref.object_type:
                            elem.attrib['_original_id'] = ref.object_id
                            elem.attrib['name'] = new_id
                            break
                
                # Update all references to this object
                self._update_object_references(ref.object_id, new_id, ref.object_type)
                
                logger.info(f"Updated duplicate {ref.object_id} to {new_id}")
        
        return True
    
    def _update_object_id(self, old_id: str, new_id: str, object_type: str):
        """Update an object's ID in the XML"""
        if self.root is None:
            return
            
        for elem in self.root.iter():
            # Compare with local name (without namespace)
            elem_type = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
            if elem.attrib.get('name') == old_id and elem_type == object_type:
                elem.attrib['name'] = new_id
                break
    
    def _update_object_references(self, old_id: str, new_id: str, object_type: str):
        """Update all references to an object ID throughout the XML"""
        # This is a simplified implementation - you'd need to handle different reference types
        # based on the object type and where it's referenced
        
        if self.root is None:
            return
            
        # Update ref attributes
        for elem in self.root.iter():
            if elem.attrib.get('ref') == old_id:
                elem.attrib['ref'] = new_id
            
            # Update other common reference attributes
            for attr in ['data', 'source', 'target', 'value']:
                if elem.attrib.get(attr) == old_id:
                    elem.attrib[attr] = new_id
    
    def repair_corrupted_report(self) -> bool:
        """
        Repair "Report Could Not Be Opened" errors
        Uses the systematic removal/addition approach from documentation
        """
        logger.info("Starting corrupted report repair...")
        
        # Create a backup of the original
        backup_path = f"{self.xml_file_path}.backup"
        with open(backup_path, 'w') as f:
            f.write(self.xml_content)
        logger.info(f"Created backup: {backup_path}")
        
        # Method 1: Remove object types one by one until report opens
        logger.info("Attempting repair by removing object types...")
        
        # Create a minimal working XML structure
        minimal_xml = self._create_minimal_xml()
        
        # Try adding object types back one by one
        for obj_type in reversed(self.object_types):
            logger.info(f"Testing with {obj_type}...")
            
            # Extract the object type section from original XML
            obj_section = self._extract_object_section(obj_type)
            if obj_section:
                # Add to minimal XML
                test_xml = self._add_section_to_xml(minimal_xml, obj_type, obj_section)
                
                # Validate the XML
                if self._validate_xml_section(test_xml, obj_type):
                    logger.info(f"Successfully added {obj_type}")
                    minimal_xml = test_xml
                else:
                    logger.warning(f"Failed to add {obj_type}, skipping")
        
        # Update the XML content with the repaired version
        self.xml_content = minimal_xml
        self.root = ET.fromstring(minimal_xml)
        
        return True
    
    def _create_minimal_xml(self) -> str:
        """Create a minimal working BIRD XML structure"""
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<SASReport xmlns="http://www.sas.com/sasreportmodel/bird-3.2.2" nextUniqueNameIndex="{self.next_unique_name_index}">
    <DataSources/>
    <DataDefinitions/>
    <VisualElements/>
    <Views/>
    <PromptDefinitions/>
    <Actions/>
    <Conditions/>
    <Interactions/>
    <MediaSchemes/>
    <DataSourceMappings/>
    <Groupings/>
    <CustomSorts/>
</SASReport>'''
    
    def _extract_object_section(self, obj_type: str) -> Optional[str]:
        """Extract a specific object type section from the original XML"""
        try:
            # Find the section in the original XML
            pattern = rf'<{obj_type}[^>]*>.*?</{obj_type}>'
            match = re.search(pattern, self.xml_content, re.DOTALL)
            return match.group(0) if match else None
        except Exception as e:
            logger.error(f"Failed to extract {obj_type} section: {e}")
            return None
    
    def _add_section_to_xml(self, xml_content: str, obj_type: str, section_content: str) -> str:
        """Add a section to the XML content"""
        # Find the closing tag and insert before it
        closing_tag = f"</{obj_type}>"
        if closing_tag in xml_content:
            # Replace the empty section
            empty_section = f"<{obj_type}/>"
            return xml_content.replace(empty_section, section_content)
        else:
            # Insert before the closing Report tag
            return xml_content.replace("</Report>", f"{section_content}\n</Report>")
    
    def _validate_xml_section(self, xml_content: str, section_name: str) -> bool:
        """Basic validation of XML section"""
        try:
            ET.fromstring(xml_content)
            return True
        except ET.ParseError:
            return False
    
    def analyze_xml_structure(self) -> Dict:
        """Analyze the XML structure and provide insights"""
        analysis = {
            'total_objects': 0,
            'object_counts': {},
            'duplicate_objects': {},
            'null_candidates': set(),
            'unused_prompts': set(),
            'potential_issues': []
        }
        
        if self.root is None:
            analysis['potential_issues'].append("No XML root element found")
            return analysis
        
        # Count objects by type
        for elem in self.root.iter():
            if 'name' in elem.attrib:
                analysis['total_objects'] += 1
                # Get the local name without namespace prefix
                obj_type = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                analysis['object_counts'][obj_type] = analysis['object_counts'].get(obj_type, 0) + 1
        
        # Find duplicates
        duplicates = self.find_duplicate_objects()
        analysis['duplicate_objects'] = {k: len(v) for k, v in duplicates.items()}
        
        # Find null candidates
        null_candidates = self.find_null_candidates()
        analysis['null_candidates'] = null_candidates
        
        # Find unused prompts
        unused_prompts = self.find_unused_prompts()
        analysis['unused_prompts'] = unused_prompts
        
        # Identify potential issues
        if duplicates:
            analysis['potential_issues'].append(f"Found {len(duplicates)} duplicate object IDs")
        
        if null_candidates:
            analysis['potential_issues'].append(f"Found {len(null_candidates)} null candidates")
        
        if unused_prompts:
            analysis['potential_issues'].append(f"Found {len(unused_prompts)} unused prompts")
        
        # Check for common corruption patterns
        if not self._validate_xml_section(self.xml_content, "Report"):
            analysis['potential_issues'].append("XML structure appears corrupted")
        
        return analysis
    
    def print_analysis(self):
        """Print a detailed analysis of the XML file"""
        analysis = self.analyze_xml_structure()
        
        print("\n" + "="*60)
        print("SAS Visual Analytics BIRD XML Analysis")
        print("="*60)
        print(f"File: {self.xml_file_path}")
        print(f"Total Objects: {analysis['total_objects']}")
        
        # Define the specific object types to show
        target_types = [
            'ParentDataDefinition',
            'DataDefinition', 
            'DataSource',
            'DataItem',
            'PredefinedDataItem',
            'VisualElements',
            'Image',
            'VisualContainer',
            'Prompt',
            'MediaContainer',
            'Section',
            'Container',
            'Actions',
            'NavigationAction'
        ]
        
        # Create a filtered and summed object counts dictionary
        filtered_counts = {}
        for obj_type, count in analysis['object_counts'].items():
            # Handle DataDefinition/DataDefinitions summing
            if obj_type in ['DataDefinition', 'DataDefinitions']:
                if 'DataDefinition' not in filtered_counts:
                    filtered_counts['DataDefinition'] = 0
                filtered_counts['DataDefinition'] += count
            # Handle DataSource/DataSources summing
            elif obj_type in ['DataSource', 'DataSources']:
                if 'DataSource' not in filtered_counts:
                    filtered_counts['DataSource'] = 0
                filtered_counts['DataSource'] += count
            # Add other target types
            elif obj_type in target_types:
                filtered_counts[obj_type] = count
        
        print("\nObject Counts by Type:")
        for obj_type in target_types:
            if obj_type in filtered_counts:
                print(f"  {obj_type}: {filtered_counts[obj_type]}")
            else:
                print(f"  {obj_type}: 0")
        
        if analysis['duplicate_objects']:
            print(f"\nDuplicate Objects ({len(analysis['duplicate_objects'])}):")
            for obj_id, count in analysis['duplicate_objects'].items():
                print(f"  {obj_id}: {count} instances")
        
        if analysis['null_candidates']:
            print(f"\nNull Candidates ({len(analysis['null_candidates'])}):")
            for obj_id in sorted(analysis['null_candidates']):
                print(f"  {obj_id}: Referenced but not defined")
        
        if analysis['unused_prompts']:
            print(f"\nUnused Prompts ({len(analysis['unused_prompts'])}):")
            for prompt_id in sorted(analysis['unused_prompts']):
                print(f"  {prompt_id}: Defined but not referenced")
        
        if analysis['potential_issues']:
            print(f"\nPotential Issues:")
            for issue in analysis['potential_issues']:
                print(f"  ⚠️  {issue}")
        else:
            print("\n✅ No obvious issues detected")
        
        print("="*60)

def extract_reports_from_json(json_file_path: str) -> list:
    """
    Extract all report XMLs from a Viya transfer JSON file (as in ReportExtractor.py)
    Returns a list of (report_name, xml_content) tuples
    """
    with open(json_file_path, encoding="utf-8") as jfile:
        transport = json.load(jfile)
    reports = []
    for k in transport.get("transferDetails", []):
        if k["transferObject"]["summary"]["type"] == "report":
            rname = k["transferObject"]["summary"]["name"]
            content = k["transferObject"]["content"]
            compress = False
            if content.startswith("TRUE###"):
                real_content = content[7:]
                compress = True
            elif content.startswith("FALSE###"):
                real_content = content[8:]
            else:
                real_content = content
            byte_decoded = base64.b64decode(real_content)
            if compress:
                byte_decompressed = zlib.decompress(byte_decoded)
            else:
                byte_decompressed = byte_decoded
            object_json = json.loads(byte_decompressed.decode("utf8"))
            xml = object_json["transferableContent"]["content"]
            reports.append((rname, xml))
    return reports

def main():
    """Main function for command-line usage"""
    import sys
    import os
    parser = argparse.ArgumentParser(description='SAS Visual Analytics BIRD XML Repair Tool')
    parser.add_argument('xml_file', nargs='?', help='Path to the BIRD XML or JSON file to repair (optional - will use first .xml file in current directory if not specified)')
    parser.add_argument('--analyze', action='store_true', help='Analyze the XML file without repairing')
    parser.add_argument('--repair-duplicates', action='store_true', help='Repair duplicate object IDs')
    parser.add_argument('--repair-null-candidates', action='store_true', help='Repair null candidates')
    parser.add_argument('--repair-unused-prompts', action='store_true', help='Remove unused prompts')
    parser.add_argument('--repair-corrupted', action='store_true', help='Repair corrupted report structure')
    parser.add_argument('--output', help='Output file path for repaired XML')
    args = parser.parse_args()

    xml_file = args.xml_file
    if xml_file is None:
        xml_files = list(Path('.').glob('*.xml'))
        if not xml_files:
            print("❌ No XML files found in current directory")
            print("Usage: python sas_va_xml_repair.py [xml_file] [options]")
            sys.exit(1)
        xml_file = str(xml_files[0])
        print(f"📁 Using XML file: {xml_file}")

    # --- JSON input support ---
    if xml_file.lower().endswith('.json'):
        reports = extract_reports_from_json(xml_file)
        if not reports:
            print(f"No reports found in {xml_file}")
            sys.exit(1)
        # Get the directory of the input JSON file
        out_dir = os.path.dirname(os.path.abspath(xml_file))
        for rname, xml in reports:
            print(f"\n--- Repairing report: {rname} ---")
            xml_file_path = os.path.join(out_dir, f"{rname}.xml")
            repaired_file = os.path.join(out_dir, f"{rname}_repaired.xml")
            with open(xml_file_path, "w", encoding="utf-8") as f:
                f.write(xml)
            repair_tool = BIRDXMLRepair(xml_file_path)
            if not repair_tool.load_xml():
                print(f"Failed to load XML for report {rname}")
                continue
            repair_tool.print_analysis()
            # Auto-repair mode
            issues_found = False
            if repair_tool.find_null_candidates():
                issues_found = True
                print("🔧 Repairing null candidates...")
                repair_tool.repair_null_candidates()
            if repair_tool.find_duplicate_objects():
                issues_found = True
                print("🔧 Repairing duplicate names...")
                repair_tool.repair_duplicate_names()
            if repair_tool.find_unused_prompts():
                issues_found = True
                print("🔧 Removing unused prompts...")
                repair_tool.repair_unused_prompts()
            if issues_found:
                repair_tool.save_xml(repaired_file)
                print(f"✅ Repaired XML saved to: {repaired_file}")
            else:
                print("✅ No repairs needed for this report.")
        print(f"\nAll reports in {xml_file} have been processed.")
        sys.exit(0)

    # --- XML input logic (existing) ---
    repair_tool = BIRDXMLRepair(xml_file)
    if not repair_tool.load_xml():
        print("Failed to load XML file")
        sys.exit(1)
    repair_tool.print_analysis()
    perform_repairs = True
    if args.analyze:
        perform_repairs = False
    elif not any([args.repair_duplicates, args.repair_null_candidates, args.repair_corrupted]):
        analysis = repair_tool.analyze_xml_structure()
        if analysis['duplicate_objects'] or analysis['null_candidates'] or analysis['unused_prompts'] or analysis['potential_issues']:
            print("\n🔧 Auto-repair mode: Issues detected, performing repairs...")
            args.repair_duplicates = bool(analysis['duplicate_objects'])
            args.repair_null_candidates = bool(analysis['null_candidates'])
            args.repair_unused_prompts = bool(analysis['unused_prompts'])
            args.repair_corrupted = any('corrupted' in issue.lower() for issue in analysis['potential_issues'])
        else:
            print("\n✅ No issues detected - no repairs needed")
            perform_repairs = False
    if perform_repairs:
        if args.repair_duplicates:
            print("🔧 Repairing duplicate object IDs...")
            repair_tool.repair_duplicate_names()
        if args.repair_null_candidates:
            print("🔧 Repairing null candidates...")
            repair_tool.repair_null_candidates()
        if args.repair_unused_prompts:
            print("🔧 Removing unused prompts...")
            repair_tool.repair_unused_prompts()
        if args.repair_corrupted:
            print("🔧 Repairing corrupted report structure...")
            repair_tool.repair_corrupted_report()
        if repair_tool.save_xml(args.output):
            print("✅ Repaired XML saved successfully")
        else:
            print("❌ Failed to save repaired XML")
            sys.exit(1)

if __name__ == "__main__":
    main() 